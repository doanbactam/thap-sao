// V2: build-power heuristic. Turns stats + effect bundle + weapon config into an estimated DPS, effective HP and a
// single "power" score (100 = a fresh Kiếm & Khiên hero with no items). Used by choice cards (concrete deltas), the
// greedy policy and the headless balance simulator (src/systems/sim.ts). Framework-free, deterministic, no RNG.
import type { Stats } from './stats';
import { BASE_STATS, computeStats } from './stats';
import { critMultiplier } from './damage';
import { specialsOf, procScale, procElement, type Bundle, type Ctx, condOk } from './effects';
import { buildWeapon, type WeaponConfig } from './weapons';
import { getArtifact } from './registry';
import { emptyBundle } from './effects';

/** Assumed combat tempo (per second) used by the estimate. */
export const TEMPO = { uptime: 0.5, kills: 0.35, dashes: 0.25, hurts: 0.18, behindShare: 0.2, dashHitShare: 0.1, guardPerfects: 0.08, fightSeconds: 20, avgHit: 10 };
/** Damage a temporary shield of `v` lasting `sec` actually absorbs (it does not stack; only hits inside the window count). */
const absorbed = (v: number, sec: number) => Math.min(v, sec * TEMPO.hurts * TEMPO.avgHit) * 0.6;
const AREA: Record<string, number> = { frostRing: 2, meteor: 1.5, lightning: 1, orb: 1, explode: 1.5, shockwave: 1.2, trail: 1.3, nova: 1.5, thorns: 1 };

export interface Power { dps: number; ehp: number; score: number; parts: Record<string, number> }
const tagsOf = (id: string) => (getArtifact(id)?.tags as string[] | undefined) ?? [];

export function estimatePower(s: Stats, b: Bundle, w: WeaponConfig, ctx?: Ctx, level = 1): Power {
  const r = estimatePowerRaw(s, b, w, ctx, level); r.score = 100 * Math.sqrt((r.dps / REF.dps) * (r.ehp / REF.ehp)); return r;
}
function estimatePowerRaw(s: Stats, b: Bundle, w: WeaponConfig, ctx: Ctx = { hpPct: 1, mpPct: 1, dashLeft: 1, bossRoom: false }, level = 1): Power {
  const sp = specialsOf(b); const parts: Record<string, number> = {};
  const hitsPerSec = (1 / Math.max(0.05, w.interval)) * (s.attackSpeed / 100) * TEMPO.uptime;
  const coef = w.coefs.reduce((a, c) => a + c, 0) / Math.max(1, w.coefs.length);
  const share = w.magicShare; const baseStat = s[w.element] * (1 - share) + s.magic * share;
  const crit = Math.min(100, s.critChance + w.critBonus) / 100;
  const critMul = 1 + crit * (critMultiplier(s.critDamage) - 1);
  const dmgPct = 1 + (s.damagePct + w.damagePct) / 100;
  const hit = baseStat * coef * dmgPct * critMul;
  // ---- on-hit statuses (steady-state approximation) ----
  const rate: Record<string, number> = {};
  for (const t of b.onHit) if (condOk(t.when, ctx)) rate[t.e.apply] = (rate[t.e.apply] ?? 0) + t.chance * t.value * hitsPerSec;
  if (w.element !== 'physical') { const st = ({ fire: 'burn', ice: 'frostbite', lightning: 'shock' } as Record<string, string>)[w.element]; rate[st] = (rate[st] ?? 0) + 0.15 * hitsPerSec; }
  const burnStacks = Math.min(10, (rate.burn ?? 0) * 3); parts.burn = burnStacks * Math.max(2, s.fire * 0.15);
  const poisonStacks = Math.min(8, (rate.poison ?? 0) * 5); parts.poison = poisonStacks * Math.max(2, s.fire * 0.15) * 0.6;
  const frozenUp = Math.min(0.5, ((rate.frostbite ?? 0) / 5) * 1.5);
  const shockUp = Math.min(1, (rate.shock ?? 0) * 3);
  const woundStacks = Math.min(5, (rate.wound ?? 0) * 4);
  const anyUp = 1 - (1 - Math.min(1, burnStacks / 2)) * (1 - Math.min(1, poisonStacks / 2)) * (1 - frozenUp) * (1 - shockUp) * (1 - Math.min(1, woundStacks / 2)) * (1 - Math.min(1, (rate.frostbite ?? 0)));
  const mult = 1 + shockUp * 0.15 + frozenUp * (sp.freezeShatter ?? 0) / 100 + shockUp * (sp.lightningRod ?? 0) / 100
    + TEMPO.behindShare * (sp.backstab ?? 0) / 100 + anyUp * (sp.debuffAmp ?? 0) / 100 + TEMPO.dashHitShare * (sp.dashStrike ?? 0) / 100 + woundStacks * 0.06;
  parts.weapon = (hit * mult + (sp.doomMark ?? 0) / 10) * hitsPerSec;
  parts.chain = (rate.shock ?? 0) * (3 + (sp.lightningRod ? 1 : 0)) * (s.lightning * 0.4 + (sp.lightningRod ?? 0) * 0.2) * 0.5;
  const statusMult = 1 + anyUp * (sp.debuffAmp ?? 0) / 100; parts.burn *= statusMult; parts.poison *= statusMult;
  // ---- procs ----
  let sustain = 0, shield = 0; parts.procs = 0;
  const cdr = 1 - Math.min(60, s.cooldownPct) / 100;
  const proc = (action: string, kind: string, v: number, source: string, perSec: number) => {
    const el = procElement(source, `${kind}:${action}`, tagsOf);
    parts.procs += v * procScale(s, el, level) * (AREA[action] ?? 1) * perSec;
  };
  for (const t of b.periodic) { if (!condOk(t.when, ctx)) continue; const per = 1 / Math.max(0.5, t.e.every * cdr); if (t.e.action === 'heal') sustain += t.value * per; else proc(t.e.action, 'periodic', t.value, t.source, per); }
  for (const t of b.onKill) { if (!condOk(t.when, ctx)) continue; if (t.e.action === 'explode') proc('explode', 'kill', t.value, t.source, TEMPO.kills); else if (t.e.action === 'heal') sustain += t.value * TEMPO.kills; }
  const dashRate = TEMPO.dashes * Math.min(2, (s.dashCount / 2) * (s.dashRecovery / 100));
  for (const t of b.onDash) { if (!condOk(t.when, ctx)) continue; if (t.e.action === 'heal') sustain += t.value * dashRate; else if (t.e.action === 'shield') shield += absorbed(t.value, 2) * dashRate * TEMPO.fightSeconds; else proc(t.e.action, 'dash', t.value, t.source, dashRate); }
  const hurtRate = TEMPO.hurts * (1 - Math.min(60, s.evasion) / 100);
  for (const t of b.onHurt) { if (!condOk(t.when, ctx)) continue; if (t.e.action === 'mp') continue; proc(t.e.action, 'hurt', t.value, t.source, t.e.action === 'nova' ? Math.min(hurtRate, 1 / 3) : hurtRate); }
  if (sp.galeDash) parts.procs += sp.galeDash * dashRate * 2;
  if (sp.guardCounter && w.hasGuard) parts.procs += sp.guardCounter * TEMPO.guardPerfects * 1.5;
  // ---- MP: weapon special (≈2.5× hit on ~1.5 targets) + spells share the MP budget ----
  let mpPerSec = s.mpRegen * 0.6 + (s.maxMp / TEMPO.fightSeconds) * 0.5;
  for (const t of b.onKill) if (t.e.action === 'mp' && condOk(t.when, ctx)) mpPerSec += t.value * TEMPO.kills;
  for (const t of b.onHurt) if (t.e.action === 'mp' && condOk(t.when, ctx)) mpPerSec += t.value * TEMPO.hurts;
  // ---- spells ----
  parts.spells = 0;
  const spellCrit = Math.min(1, (s.critChance + (sp.spellCrit ?? 0)) / 100) * 0.5 + 1;
  const echo = 1 + (sp.spellEcho ?? 0) / 100;
  const spells = b.spells.slice(0, 2);
  for (const t of spells) {
    const casts = Math.min(1 / Math.max(0.3, t.e.cooldown * cdr), mpPerSec / Math.max(1, t.e.mpCost * spells.length)) * TEMPO.uptime;
    const dmg = (t.value + s.magic) * dmgPct * spellCrit * echo;
    switch (t.e.spell) {
      case 'icebolt': parts.spells += dmg * casts; break;
      case 'fireball': parts.spells += dmg * 1.5 * casts; break;
      case 'chainLightning': parts.spells += dmg * (1 + 0.7 * 2) * casts; break;
      case 'arcaneMissiles': parts.spells += dmg * 3 * casts; break;
      case 'shieldBubble': shield += absorbed(t.value, 4) * casts * TEMPO.fightSeconds; break;
      case 'blink': shield += 4 * casts * TEMPO.fightSeconds; break;
    }
  }
  const spellMp = spells.reduce((a, t) => a + t.e.mpCost * Math.min(1 / Math.max(0.3, t.e.cooldown * cdr), mpPerSec / Math.max(1, t.e.mpCost * spells.length)) * TEMPO.uptime, 0);
  parts.special = w.specialCost > 0 ? hit * mult * 2.5 * 1.5 * Math.min(1 / 3, Math.max(0, mpPerSec - spellMp) / w.specialCost) : 0;
  // ---- companions ----
  parts.companions = 0;
  if (b.summons.length) {
    const slots = b.summons.length + Math.round(sp.extraCompanion ?? 0);
    const cm = (1 + (sp.companionDamage ?? 0) / 100) * (1 + (sp.companionHaste ?? 0) / 100) * (1 + (sp.companionCrit ?? 0) / 100 * 0.5);
    for (let i = 0; i < slots; i++) parts.companions += b.summons[i % b.summons.length].value * cm / 1.2 * TEMPO.uptime;
    if (sp.companionShare) sustain += s.maxHp * sp.companionShare / 100 * 0.8;
  }
  const dps = parts.weapon + parts.chain + parts.burn + parts.poison + parts.procs + parts.spells + parts.companions + parts.special;
  sustain += dps * s.lifesteal / 100;
  // ---- effective HP ----
  const defMul = 1 / (1 - Math.min(75, Math.max(0, s.defense)) / 100);
  const evaMul = 1 / (1 - Math.min(60, Math.max(0, s.evasion)) / 100);
  const ccMul = 1 / (1 - frozenUp * 0.5);
  const thornsHeal = 0;
  let pool = s.maxHp + sustain * TEMPO.fightSeconds + shield + thornsHeal;
  if (sp.manaShield) pool += Math.min(s.maxMp, s.maxHp) * Math.min(100, sp.manaShield) / 100;
  if (sp.phoenixRevive) pool += s.maxHp * Math.min(100, sp.phoenixRevive) / 100 * 0.5;
  const mobility = 1 + Math.max(0, s.moveSpeed - 100) / 250 + Math.max(0, s.dashCount - 2) * 0.08 + Math.max(0, s.dashRecovery - 100) / 500;
  const ehp = pool * defMul * evaMul * ccMul * mobility;
  return { dps, ehp, score: 0, parts };
}
let REF: { dps: number; ehp: number } = { dps: 1, ehp: 1 };
REF = (() => { const w = buildWeapon('swordshield', []); const s = computeStats([], BASE_STATS); const p = { dps: 1, ehp: 1 }; const b = emptyBundle();
  // inline reference without recursion on REF
  void b; p.dps = 1; p.ehp = 1; const r = estimatePowerRaw(s, emptyBundle(), w); p.dps = r.dps; p.ehp = r.ehp; return p; })();
export const POWER_REF = REF;
