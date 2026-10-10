// Active skills (v2 skills polish): quick-slot spells (keys 1/2) and the weapon special (F / L / touch "Kỹ năng").
// Pure rules only — tuning table, cast buffer + wind-up + cancel rules, cooldown/MP checks, aim shapes, touch
// hold-to-aim / drag-to-cancel, and the numbers the HUD tooltip shows. Unit-tested in tests/skills.test.ts;
// scene glue lives in ./skillFx.ts. Tuning rationale: docs/V2_SKILLS.md (keep both in sync).
import type { SpellId, WeaponId } from '../data/types';
import type { Stats } from './stats';
import { CAPS } from './stats';
import { critMultiplier } from './damage';
import { BUFFER, canDash, type CombatState } from './combat';
import type { Specials } from './specials';

export type SkillKey = 'spell1' | 'spell2' | 'special';
export const SKILL_KEYS: SkillKey[] = ['spell1', 'spell2', 'special'];
export type AimKind = 'line' | 'circle' | 'cone' | 'self' | 'target' | 'blink';
/** Aim preview shape. line: length × width from the hero; circle: radius around the hero; cone: length + half-angle;
 *  target: range circle + ring on the auto target; blink: line + landing ring; self: small ring on the hero. */
export interface AimShape { kind: AimKind; range: number; width: number; radius?: number; half?: number }
/** Feel data shared by spells and weapon specials. windup = seconds from the press (after the buffer) to the effect;
 *  hitstop = seconds of freeze on the cast's hit; shake = SHAKE tier on the effect. */
export interface SkillFeel { windup: number; hitstop: number; shake: 0 | 1 | 2 | 3; sfx: string; color: number; aim: AimShape }

// ---------------- spells (cost/cooldown/power live on the artifact data, src/data/artifacts.ts) ----------------
export interface SpellTune extends SkillFeel { role: string; speed?: number; explode?: number; chainFalloff?: number; missiles?: number; missileMagic?: number; spread?: number; shieldTime?: number }
export const SPELL: Record<SpellId, SpellTune> = {
  icebolt: { role: 'Rẻ, nhanh, một mục tiêu: làm chậm (Tê cóng) rồi đánh', windup: 0.1, hitstop: 0.04, shake: 1, sfx: 'sp_ice', color: 0x9be4ff, speed: 620, aim: { kind: 'line', range: 560, width: 12 } },
  fireball: { role: 'Nổ diện rộng vào cụm địch (Bỏng)', windup: 0.16, hitstop: 0.06, shake: 2, sfx: 'sp_fire', color: 0xff8a3a, speed: 440, explode: 90, aim: { kind: 'line', range: 500, width: 16, radius: 90 } },
  chainLightning: { role: 'Tự nhắm, nảy 4 địch: dọn đám đông rải rác (Sốc)', windup: 0.12, hitstop: 0.05, shake: 1, sfx: 'sp_chain', color: 0xfff07a, chainFalloff: 0.8, aim: { kind: 'target', range: 500, width: 0 } },
  arcaneMissiles: { role: 'Sát thương đều, tự dẫn: bám một mục tiêu khó trúng', windup: 0.14, hitstop: 0, shake: 0, sfx: 'sp_arcane', color: 0xc9a3ff, missiles: 5, missileMagic: 0.4, spread: 0.25, speed: 380, aim: { kind: 'cone', range: 380, width: 0, half: 0.5 } },
  shieldBubble: { role: 'Phòng thủ: khiên hấp thụ trước đòn lớn', windup: 0.08, hitstop: 0, shake: 0, sfx: 'sp_shield', color: 0x8fe0ff, shieldTime: 5, aim: { kind: 'self', range: 0, width: 0, radius: 44 } },
  blink: { role: 'Cơ động: xuyên qua địch, bất tử khi dịch chuyển', windup: 0.05, hitstop: 0, shake: 0, sfx: 'sp_blink', color: 0xb8a0ff, aim: { kind: 'blink', range: 140, width: 26, radius: 18 } },
};

// ---------------- weapon specials (MP = def.specialMp × Anvil specialCostPct; data in src/data/weapons.ts) ----------------
export interface SpecialTune extends SkillFeel {
  name: string; role: string; cooldown: number; coef: number; mode: 'press' | 'charge';
  dist?: number; stun?: number; iframes?: number; knockMul?: number; tick?: number; minPower?: number; speed?: number; size?: number; perfectCdRefund?: boolean;
}
export const SPECIAL: Record<WeaponId, SpecialTune> = {
  swordshield: { name: 'Lao Khiên', role: 'Áp sát + khống chế: húc văng, choáng', mode: 'press', cooldown: 2.0, coef: 1.8, dist: 170, stun: 1.2, iframes: 0.3, knockMul: 2,
    windup: 0.08, hitstop: 0.07, shake: 2, sfx: 'sk_bash', color: 0xffe7a0, aim: { kind: 'line', range: 170, width: 36 } },
  greatsword: { name: 'Xoáy Kiếm', role: 'Dọn đám đông: xoay chém 360° (giữ để xoay lâu hơn)', mode: 'charge', cooldown: 3.0, coef: 0.7, tick: 0.2, minPower: 0.75,
    windup: 0, hitstop: 0.03, shake: 1, sfx: 'sk_spin', color: 0xffd27a, aim: { kind: 'circle', range: 0, width: 0, radius: 86 } },
  dagger: { name: 'Bước Bóng', role: 'Dồn sát thương một mục tiêu: dịch ra sau lưng, đâm chí mạng', mode: 'press', cooldown: 1.5, coef: 2.0, dist: 420, iframes: 0.3,
    windup: 0.05, hitstop: 0.08, shake: 2, sfx: 'sk_shadow', color: 0xb8a0ff, aim: { kind: 'target', range: 420, width: 0 } },
  katana: { name: 'Bạt Đao', role: 'Kỹ năng thời điểm: thả đúng lúc = chí mạng + hồi chiêu ngay', mode: 'charge', cooldown: 1.2, coef: 2.4, dist: 230, iframes: 0.25, perfectCdRefund: true,
    windup: 0, hitstop: 0.09, shake: 2, sfx: 'sk_iaido', color: 0xffffff, aim: { kind: 'line', range: 230, width: 30 } },
  crossbow: { name: 'Tên Xuyên Phá', role: 'Bắn tỉa theo đường thẳng: xuyên mọi kẻ địch, không tốn tên', mode: 'press', cooldown: 1.0, coef: 4.2, speed: 900, size: 16, knockMul: 1.5,
    windup: 0.12, hitstop: 0.05, shake: 1, sfx: 'sk_pierce', color: 0xfff3b0, aim: { kind: 'line', range: 700, width: 14 } },
  staff: { name: 'Bộc Phá Nguyên Tố', role: 'Nút thoát hiểm: nổ quanh người, đẩy lùi + hiệu ứng nguyên tố', mode: 'press', cooldown: 2.5, coef: 3.0, knockMul: 1.8, iframes: 0.2,
    windup: 0.18, hitstop: 0.06, shake: 2, sfx: 'sk_nova', color: 0xff8a3a, aim: { kind: 'circle', range: 0, width: 0, radius: 140 } },
};
/** v1/v2-depth values, for the docs table and the "before → after" tests. */
export const SPECIAL_BEFORE: Record<WeaponId, { mp: number; cooldown: number; coef: number }> = {
  swordshield: { mp: 20, cooldown: 0, coef: 1.5 }, greatsword: { mp: 25, cooldown: 0, coef: 0.7 }, dagger: { mp: 15, cooldown: 0, coef: 2.0 },
  katana: { mp: 20, cooldown: 0, coef: 2.2 }, crossbow: { mp: 20, cooldown: 0, coef: 3.0 }, staff: { mp: 30, cooldown: 0, coef: 2.5 },
};

// ---------------- cost / cooldown ----------------
/** Cooldown after `cooldownPct` (capped like the stat, CAPS.cooldownPct). Applies to spells AND weapon specials. */
export const effectiveCooldown = (base: number, cooldownPct: number) => Math.max(0, base * (1 - Math.max(0, Math.min(CAPS.cooldownPct, cooldownPct)) / 100));
export type CastCheck = 'ok' | 'cooldown' | 'mp' | 'empty' | 'target';
export function checkCast(cdLeft: number, mp: number, cost: number, hasSkill = true): CastCheck {
  if (!hasSkill) return 'empty';
  if (cdLeft > 0) return 'cooldown';
  if (mp < cost) return 'mp';
  return 'ok';
}
/** Remaining-cooldown fraction for the radial sweep (1 = just used, 0 = ready). */
export const cooldownFrac = (cdLeft: number, cdMax: number) => (cdMax > 0 ? Math.max(0, Math.min(1, cdLeft / cdMax)) : 0);

// ---------------- cast state: buffer, wind-up, cancel ----------------
export interface SlotState { cd: number; cdMax: number; buf: number; pulse: number; deny: number; denyReason: CastCheck | '' }
export interface CastState { slots: Record<SkillKey, SlotState>; phase: 'idle' | 'windup'; key: SkillKey | null; t: number; windup: number; angle: number }
const slot = (): SlotState => ({ cd: 0, cdMax: 0, buf: 0, pulse: 0, deny: 0, denyReason: '' });
export const newCasts = (): CastState => ({ slots: { spell1: slot(), spell2: slot(), special: slot() }, phase: 'idle', key: null, t: 0, windup: 0, angle: 0 });
export const READY_PULSE = 0.35, DENY_FLASH = 0.35;
/** A skill press is buffered BUFFER s (same 120 ms as attacks/dash) and fires as soon as the cast window opens. */
export function bufferCast(c: CastState, key: SkillKey, angle: number) { c.slots[key].buf = BUFFER; if (c.phase === 'idle') c.angle = angle; }
/** Advance timers. Returns the keys whose cooldown just ended (HUD ready pulse + ping). */
export function tickCasts(c: CastState, dt: number): SkillKey[] {
  const ready: SkillKey[] = [];
  for (const k of SKILL_KEYS) {
    const s = c.slots[k];
    s.buf = Math.max(0, s.buf - dt); s.pulse = Math.max(0, s.pulse - dt); s.deny = Math.max(0, s.deny - dt);
    if (s.cd > 0) { s.cd = Math.max(0, s.cd - dt); if (s.cd === 0) { s.pulse = READY_PULSE; ready.push(k); } }
  }
  if (c.phase === 'windup') c.t += dt;
  return ready;
}
/** Cast window = the dash-cancel rule of combat.ts (idle, a feint-able startup, or recovery past dashCancel),
 *  and never while dashing, guarding, charging an attack, spinning or already casting. */
export function canCast(cs: CombatState, o: { dashing: boolean; guarding: boolean; charging: boolean; spinning: boolean; casting: boolean }): boolean {
  if (o.dashing || o.guarding || o.charging || o.spinning || o.casting) return false;
  return canDash(cs);
}
/** Next buffered key that may start now (spells before special: they were pressed deliberately with a number key). */
export function nextBuffered(c: CastState): SkillKey | null { for (const k of SKILL_KEYS) if (c.slots[k].buf > 0) return k; return null; }
export function beginCast(c: CastState, key: SkillKey, windup: number, angle: number) { c.slots[key].buf = 0; c.phase = 'windup'; c.key = key; c.t = 0; c.windup = windup; c.angle = angle; }
/** Returns the key when its wind-up has elapsed (the scene re-checks cost, commits and performs it). */
export function windupDone(c: CastState): SkillKey | null {
  if (c.phase !== 'windup' || c.t < c.windup) return null;
  const k = c.key; c.phase = 'idle'; c.key = null; c.t = 0; return k;
}
/** Dash (or a stun) during the wind-up cancels the cast. Nothing was spent: MP + cooldown are committed on release. */
export function cancelCast(c: CastState): SkillKey | null { if (c.phase !== 'windup') return null; const k = c.key; c.phase = 'idle'; c.key = null; c.t = 0; return k; }
/** Commit a cast: cooldown (after cooldownPct) starts now. */
export function commitCast(c: CastState, key: SkillKey, cooldown: number) { const s = c.slots[key]; s.cd = cooldown; s.cdMax = cooldown; s.pulse = 0; }
/** Denied press (cooldown / MP / no target): HUD flashes the slot (and the MP bar for 'mp'), deny sfx. */
export function denyCast(c: CastState, key: SkillKey, reason: CastCheck) { const s = c.slots[key]; s.buf = 0; s.deny = DENY_FLASH; s.denyReason = reason; }
/** Moving during a wind-up is slowed like an attack startup. */
export const CAST_MOVE_MUL = 0.5;

// ---------------- hold-to-aim (keyboard hold / touch drag) ----------------
export const AIM_DEAD = 18, AIM_CANCEL = 110;
/** Touch drag from the skill button centre: inside AIM_DEAD = auto aim, up to AIM_CANCEL = aim along the drag, beyond = cancel. */
export function aimFromDrag(dx: number, dy: number): { mode: 'auto' | 'aim' | 'cancel'; angle: number } {
  const d = Math.hypot(dx, dy); const angle = Math.atan2(dy, dx);
  return { mode: d < AIM_DEAD ? 'auto' : d > AIM_CANCEL ? 'cancel' : 'aim', angle };
}
/** Aim angle for a cast: explicit drag aim > mouse aim > nearest enemy inside the skill's reach > facing. */
export function resolveAim(o: { drag?: { mode: string; angle: number } | null; mouse?: number | null; target?: { x: number; y: number } | null; px: number; py: number; facing: number }): number {
  if (o.drag && o.drag.mode === 'aim') return o.drag.angle;
  if (o.mouse !== null && o.mouse !== undefined) return o.mouse;
  if (o.target) return Math.atan2(o.target.y - o.py, o.target.x - o.px);
  return o.facing;
}
/** Reach used to pick an auto-aim target for a shape. */
export const aimReach = (a: AimShape) => (a.kind === 'circle' || a.kind === 'self' ? a.radius ?? 0 : a.range + (a.radius ?? 0));
/** Geometry for the preview / tests: end point of a line, cone edges. */
export function aimGeometry(a: AimShape, x: number, y: number, angle: number, rangeOverride?: number) {
  const r = rangeOverride ?? a.range;
  return { x1: x + Math.cos(angle) * r, y1: y + Math.sin(angle) * r, left: angle - (a.half ?? 0), right: angle + (a.half ?? 0), range: r };
}

// ---------------- damage numbers (shared by the scene and the HUD tooltip) ----------------
/** Spell crit chance (spellCrit special adds to stat crit) and multiplier (now follows critDamage like weapon hits). */
export const spellCrit = (stats: Stats, sp: Specials) => ({ chance: Math.min(100, stats.critChance + (sp.spellCrit ?? 0)), mult: critMultiplier(stats.critDamage) });
/** One instance of a spell's damage before crit: (power + magic × share) × (1 + damage%). Arcane missiles use share 0.4 per missile. */
export function spellHit(stats: Stats, spell: SpellId, power: number): number {
  const share = SPELL[spell].missileMagic ?? 1;
  return Math.max(1, Math.round((power + stats.magic * share) * (1 + (stats.damagePct ?? 0) / 100)));
}
export interface SkillInfo { key: SkillKey; name: string; role: string; mp: number; cooldown: number; damage: number; hits: number; crit: number; echo: number; extra: string }
/** Tooltip numbers for a spell slot (everything the build modifies: power level, magic, damage%, cooldown%, spellCrit, spellEcho, critDamage). */
export function spellInfo(key: SkillKey, name: string, spell: SpellId, power: number, mpCost: number, cooldown: number, stats: Stats, sp: Specials): SkillInfo {
  const T = SPELL[spell]; const c = spellCrit(stats, sp);
  const dmg = spell === 'shieldBubble' || spell === 'blink' ? 0 : spellHit(stats, spell, power);
  const extra = spell === 'shieldBubble' ? `Khiên ${Math.round(power)} · ${T.shieldTime}s` : spell === 'blink' ? `${Math.round(Math.max(80, power))} px · bất tử` : spell === 'fireball' ? `Nổ ${T.explode}px` : spell === 'chainLightning' ? `Nảy ${Math.round((T.chainFalloff ?? 0.8) * 100)}%` : spell === 'arcaneMissiles' ? `${T.missiles} tia` : '';
  return { key, name, role: T.role, mp: mpCost, cooldown: +effectiveCooldown(cooldown, stats.cooldownPct).toFixed(2), damage: dmg, hits: T.missiles ?? 1, crit: c.chance, echo: sp.spellEcho ?? 0, extra };
}
/** Tooltip numbers for the weapon special (weapon element stat × coef × damage%; Anvil cost mods; cooldown%). */
export function specialInfo(weapon: WeaponId, mpCost: number, elementStat: number, stats: Stats, magicShare = 0, staffNova = 1): SkillInfo {
  const T = SPECIAL[weapon];
  const base = elementStat * (1 - magicShare) + stats.magic * magicShare;
  const coef = weapon === 'katana' ? T.coef * 1.2 : T.coef; // iaido at the perfect release (power 1.2)
  const dmg = Math.round(base * coef * (1 + (stats.damagePct ?? 0) / 100) * staffNova);
  const extra = weapon === 'swordshield' ? `Choáng ${T.stun}s · bất tử khi lao` : weapon === 'greatsword' ? `mỗi ${T.tick}s` : weapon === 'dagger' ? 'Chí mạng chắc chắn' : weapon === 'katana' ? 'Thả đúng lúc: chí mạng' : weapon === 'crossbow' ? 'Xuyên tất cả' : 'Đẩy lùi + nguyên tố';
  return { key: 'special', name: T.name, role: T.role, mp: mpCost, cooldown: +effectiveCooldown(T.cooldown, stats.cooldownPct).toFixed(2), damage: dmg, hits: 1, crit: weapon === 'dagger' ? 100 : Math.min(100, stats.critChance), echo: 0, extra };
}
/** Tooltip lines (Vietnamese) for the HUD. */
export function tooltipLines(i: SkillInfo): string[] {
  const out = [i.name, `${i.mp} MP · hồi ${i.cooldown}s`];
  if (i.damage > 0) out.push(`Sát thương ${i.damage}${i.hits > 1 ? ` ×${i.hits}` : ''} · chí mạng ${Math.round(i.crit)}%`);
  if (i.extra) out.push(i.extra);
  if (i.echo > 0) out.push(`Lặp lại ${Math.round(i.echo)}%`);
  out.push(i.role);
  return out;
}
/** Value per MP for the docs table / balance tests: damage × expected targets / MP (L1-like stats). */
export function valuePerMp(damage: number, targets: number, mp: number) { return mp > 0 ? (damage * targets) / mp : 0; }
