// Enemy AI kit (all AiKind values) and boss pattern system. Pure decision functions that return actions;
// the scene executes them. Framework-free (SPEC §6).
//
// v2 (docs/V2_AI.md):
//  - every enemy attack runs idle → windup (telegraph, ≥ MIN_WINDUP, chapter-scaled) → active → recover (Exposed,
//    punishable) → cooldown;
//  - an AiWorld per room owns the attack-token pool (max N attackers at once + a minimum gap between attack starts),
//    role movement (rushers flank/surround, ranged keep a band and reposition, tanks body-block for the backline) and
//    steering separation so enemies never stack;
//  - bosses: stagger + Exposed on phase transitions, recovery after every pattern, pattern sequencing that avoids unfair
//    overlaps, enrage at low HP (faster cadence, never shorter telegraphs), telegraph floors and safe lanes in rings.
import type { AiKind, BossDef, BossAttack } from '../data/types';
import type { Rng } from './rng';
import { tuneFor, windupFor, RANGED_RECOVERY_MUL, type ChapterTune } from './difficulty';
import type { NavGrid } from './roomgen'; // v2 rooms: obstacle-aware steering (docs/V2_ROOMS.md)

export type AiAction =
  | { type: 'shoot'; angle: number; speed: number; count: number; spread: number; kind?: string }
  | { type: 'ring'; count: number; speed: number; offset: number; kind?: string }
  | { type: 'telegraphLine'; angle: number; length: number; time: number }
  | { type: 'telegraphCircle'; x: number; y: number; radius: number; time: number }
  | { type: 'lob'; x: number; y: number; radius: number; delay: number }
  | { type: 'summon'; count: number; ids?: string[] }
  | { type: 'heal'; radius: number; pct: number; amount?: number }
  | { type: 'teleport'; x: number; y: number }
  | { type: 'explode'; radius: number }
  | { type: 'charge'; angle: number; speed: number; duration: number }
  | { type: 'hazard'; x: number; y: number; radius: number; delay: number }
  | { type: 'phase'; index: number; onEnter?: string; summon?: string[] }
  | { type: 'enrage' };

export type Role = 'rusher' | 'ranged' | 'tank' | 'support' | 'static';
export function roleOf(ai: AiKind): Role {
  switch (ai) {
    case 'chaser': case 'charger': case 'exploder': return 'rusher';
    case 'shielded': return 'tank';
    case 'summoner': case 'healer': return 'support';
    case 'turret': return 'static';
    default: return 'ranged';
  }
}
/** kinds whose attack is a body hit (contact damage only while the attack is active) */
export const MELEE_KINDS: AiKind[] = ['chaser', 'charger', 'shielded'];

export interface Agent {
  x: number; y: number; vx: number; vy: number; ai: AiKind; speed: number; state: string; t: number; cd: number;
  angle: number; params: Record<string, number>; shieldAngle: number; hp: number; maxHp: number; bounds?: { w: number; h: number };
  role: Role; radius: number;
  /** locked attack direction (set at windup start, so the attack is dodgeable by moving) */
  lock: number;
  /** windup / active / recovery durations of the current attack */
  windup: number; activeDur: number; recoverDur: number;
  /** holds an attack token */
  token: boolean; tokenCost: number;
  /** seconds left in the Exposed (punish) window — scene copies it onto the status (status.expose) */
  exposedT: number;
  /** ranged strafe direction (±1) and time until it flips */
  strafe: number; strafeT: number;
  /** cooldown multiplier (elite 'swift') */
  cdMul: number;
  /** v2 rooms nav state: forced path-follow time, stuck detector (only used when the world has a NavGrid) */
  navT?: number; stuckT?: number; lastX?: number; lastY?: number;
}
export function newAgent(ai: AiKind, x: number, y: number, speed: number, hp: number, params: Record<string, number> = {}): Agent {
  return {
    x, y, vx: 0, vy: 0, ai, speed, state: 'idle', t: 0, cd: 0.6 + Math.random() * 0.8, angle: 0, params, shieldAngle: 0, hp, maxHp: hp,
    role: roleOf(ai), radius: 16, lock: 0, windup: 0, activeDur: 0, recoverDur: 0, token: false,
    tokenCost: params.swarmSize ? 0.5 : ai === 'turret' ? 0.5 : 1, exposedT: 0, strafe: Math.random() < 0.5 ? -1 : 1, strafeT: 1 + Math.random() * 2, cdMul: 1,
  };
}
const ang = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.atan2(b.y - a.y, b.x - a.x);
const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(b.x - a.x, b.y - a.y);
export const wrapAngle = (a: number) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
function steer(a: Agent, angle: number, mult = 1) { a.vx = Math.cos(angle) * a.speed * mult; a.vy = Math.sin(angle) * a.speed * mult; }
function steerTo(a: Agent, tx: number, ty: number, mult = 1, slowR = 24) {
  const d = Math.hypot(tx - a.x, ty - a.y); if (d < 4) { a.vx = a.vy = 0; return; }
  const k = Math.min(1, d / slowR); steer(a, Math.atan2(ty - a.y, tx - a.x), mult * k);
}

/** param lookup with aliases (content vocabulary: fireRate, bulletCount, bulletSpeed, keepDistance, telegraph, chargeSpeed...) */
export function pr(P: Record<string, number>, keys: string[], d: number): number { for (const k of keys) if (typeof P[k] === 'number') return P[k]; return d; }

// ---------------- room AI world: tokens, roles, separation ----------------
export interface WorldBounds { x0: number; y0: number; x1: number; y1: number }
export const DEFAULT_BOUNDS: WorldBounds = { x0: 62, y0: 154, x1: 1234, y1: 664 };
export interface AiEntry { agent: Agent; radius: number }

export class AiWorld {
  tune: ChapterTune; time = 0; lastStart = -99; holders = new Set<Agent>(); agents: Agent[] = [];
  /** free world: tokens never run out (unit tests / legacy callers) */
  free: boolean;
  /** room obstacles (v2 rooms). null = open arena (unit tests, training room) → legacy behaviour */
  nav: NavGrid | null = null;
  constructor(public chapter = 1, public hard = false, public bounds: WorldBounds = DEFAULT_BOUNDS, free = false) { this.tune = tuneFor(chapter, hard); this.free = free; }
  /** call once per frame before thinking, with every live agent of the room */
  beginFrame(dt: number, entries: AiEntry[]) {
    this.time += dt; this.agents = entries.map((e) => { e.agent.radius = e.radius; return e.agent; });
    const alive = new Set(this.agents);
    for (const h of [...this.holders]) if (!alive.has(h)) { this.holders.delete(h); h.token = false; }
  }
  used(): number { let s = 0; for (const h of this.holders) s += h.tokenCost; return s; }
  canAttack(a: Agent): boolean {
    if (a.token || this.free) return true;
    return this.time - this.lastStart >= this.tune.attackGap && this.used() + a.tokenCost <= this.tune.tokens + 1e-9;
  }
  acquire(a: Agent): boolean {
    if (a.token) return true; if (!this.canAttack(a)) return false;
    a.token = true; if (!this.free) { this.holders.add(a); this.lastStart = this.time; } return true;
  }
  /** bosses always get a token (and so leave fewer for their minions) */
  force(a: Agent) { a.token = true; if (!this.free) { this.holders.add(a); this.lastStart = this.time; } }
  release(a: Agent) { a.token = false; this.holders.delete(a); }
  /** number of agents currently in windup/active */
  attacking(): number { return this.holders.size; }

  think(a: Agent, p: { x: number; y: number }, dt: number, rng: Rng, disabled = false): AiAction[] {
    if (a.exposedT > 0) a.exposedT = Math.max(0, a.exposedT - dt);
    if (disabled) { // stun / freeze interrupts the attack (no damage) and frees the token
      a.vx = a.vy = 0;
      if (a.state === 'windup' || a.state === 'active' || a.state === 'blink') { this.release(a); a.state = 'idle'; a.t = 0; a.cd = Math.max(a.cd, 0.6); }
      return [];
    }
    const out = thinkAgent(this, a, p, dt, rng);
    if (a.state !== 'active' || !MELEE_KINDS.includes(a.ai)) this.separate(a);
    if (this.nav) this.navSteer(a, p, dt);
    return out;
  }
  /** v2 rooms: path around obstacles. No line (sight for ranged, a walkable line for melee) → follow the BFS flow
   *  field toward the player; otherwise probe ahead and rotate the heading to slide along cover; a stuck detector
   *  forces path-following for a moment. Only touches free movement (idle state). */
  navSteer(a: Agent, p: { x: number; y: number }, dt: number) {
    const nav = this.nav!;
    const moved = a.lastX === undefined ? 99 : Math.hypot(a.x - a.lastX, a.y - (a.lastY ?? a.y));
    a.lastX = a.x; a.lastY = a.y;
    if (a.state !== 'idle' || a.speed <= 0) { a.stuckT = 0; return; }
    let sp = Math.hypot(a.vx, a.vy); if (sp < 1) { a.stuckT = 0; return; }
    // stuck: wanted to move but barely did for 0.5 s
    if (moved < sp * dt * 0.25) a.stuckT = (a.stuckT ?? 0) + dt; else a.stuckT = Math.max(0, (a.stuckT ?? 0) - dt * 2);
    if ((a.stuckT ?? 0) > 0.5) { a.navT = 0.9; a.stuckT = 0; }
    if (a.navT && a.navT > 0) a.navT = Math.max(0, a.navT - dt);
    const r = Math.min(a.radius || 16, 22);
    const blocked = a.role === 'ranged' || a.role === 'support' ? !nav.los(a.x, a.y - 14, p.x, p.y - 14) : !nav.clear(a.x, a.y, p.x, p.y, r * 0.6);
    let heading = Math.atan2(a.vy, a.vx);
    if (blocked || (a.navT ?? 0) > 0) {
      const fd = nav.flowDir(a.x, a.y, p.x, p.y);
      if (fd !== null) { heading = fd; sp = Math.max(sp, a.speed * 0.85); }
    }
    // probe ahead: rotate toward the free side (prefer the strafe side), slide along faces
    const look = r + 16;
    const free = (h: number) => nav.walkable(a.x + Math.cos(h) * look, a.y + Math.sin(h) * look) && nav.walkable(a.x + Math.cos(h) * look * 0.5, a.y + Math.sin(h) * look * 0.5);
    if (!free(heading)) {
      const s = a.strafe || 1; let found = false;
      for (const d of [0.5, 1.0, 1.5, 2.0, 2.6]) { for (const sg of [s, -s]) { const h = heading + d * sg; if (free(h)) { heading = h; found = true; break; } } if (found) break; }
      if (!found) heading += Math.PI;
    }
    a.vx = Math.cos(heading) * sp; a.vy = Math.sin(heading) * sp;
  }
  /** steering separation: push away from overlapping neighbours (no stacking) */
  separate(a: Agent) {
    if (a.speed <= 0) return;
    let sx = 0, sy = 0; const ia = this.agents.indexOf(a);
    for (let i = 0; i < this.agents.length; i++) {
      const o = this.agents[i]; if (o === a) continue;
      let dx = a.x - o.x, dy = a.y - o.y; let d = Math.hypot(dx, dy); const want = a.radius + o.radius + 12;
      if (d < 0.5) { const th = (ia - i) * 2.399; dx = Math.cos(th); dy = Math.sin(th); d = 1; } // exact overlap: deterministic tie-break
      if (d < want) { const k = Math.min(1, (want - d) / want); sx += (dx / d) * k; sy += (dy / d) * k; }
    }
    if (sx || sy) { const m = Math.hypot(sx, sy); const f = Math.min(1, m) * a.speed * 1.2; a.vx += (sx / m) * f; a.vy += (sy / m) * f; }
  }
  /** flank slot: angle around the player pushed away from other rushers so they surround instead of queueing */
  flankAngle(a: Agent, p: { x: number; y: number }): number {
    const my = Math.atan2(a.y - p.y, a.x - p.x);
    const others = this.agents.filter((o) => o !== a && o.role === 'rusher' && dist(o, p) < 360);
    if (!others.length) return my;
    const minSep = Math.min(Math.PI / 2, (2 * Math.PI) / (others.length + 1)) * 0.95;
    let push = 0;
    for (const o of others) { const diff = wrapAngle(my - Math.atan2(o.y - p.y, o.x - p.x)); if (Math.abs(diff) < minSep) push += (diff === 0 ? (a.strafe) : Math.sign(diff)) * (minSep - Math.abs(diff)); }
    return my + Math.max(-0.9, Math.min(0.9, push));
  }
  inBounds(x: number, y: number, m = 40) { const b = this.bounds; return x > b.x0 + m && x < b.x1 - m && y > b.y0 + m && y < b.y1 - m && (!this.nav || this.nav.walkable(x, y)); }
  /** v2 rooms: can this agent's attack reach the player from here (sight for shots, a walkable line for lunges)? */
  hasLine(a: Agent, p: { x: number; y: number }): boolean {
    if (!this.nav) return true;
    if (MELEE_KINDS.includes(a.ai)) return this.nav.clear(a.x, a.y, p.x, p.y, Math.min(a.radius || 16, 22) * 0.5);
    if (a.ai === 'shooter' || a.ai === 'spread' || a.ai === 'turret') return this.nav.los(a.x, a.y - 14, p.x, p.y - 14);
    return true; // lobbers arc over, rings / summons / heals are not aimed
  }
}
const FREE_WORLD = new AiWorld(1, false, DEFAULT_BOUNDS, true);

/** contact damage multiplier: only the active frames of melee attacks hurt (boss: only while charging) */
export function contactMult(a: Agent, isBoss: boolean, charging: boolean): number {
  if (charging) return 1.4;
  if (isBoss) return 0;
  return a.state === 'active' && MELEE_KINDS.includes(a.ai) ? 1 : 0;
}

/** Legacy entry point: think with a free world (no token limits). */
export function think(a: Agent, p: { x: number; y: number }, dt: number, rng: Rng, w: AiWorld = FREE_WORLD, disabled = false): AiAction[] {
  return w.think(a, p, dt, rng, disabled);
}

const TELE_KEYS: Partial<Record<AiKind, string[]>> = {
  charger: ['windup', 'telegraph'], exploder: ['fuse', 'telegraph'], shielded: ['bashTelegraph', 'slamTelegraph', 'slashTelegraph', 'telegraph'],
};
function attackRange(a: Agent): number {
  const P = a.params;
  switch (a.ai) {
    case 'chaser': return pr(P, ['lungeRange'], 34 + a.radius);
    case 'charger': return pr(P, ['range'], 260);
    case 'shielded': return pr(P, ['slashRange', 'slamRadius'], 70) + 10;
    case 'exploder': return pr(P, ['triggerRange'], 44);
    default: return 560;
  }
}
function interval(a: Agent): number {
  const P = a.params;
  switch (a.ai) {
    case 'chaser': return pr(P, ['swoopInterval', 'cooldown'], 1.2);
    case 'charger': return pr(P, ['cooldown'], 1.2);
    case 'shielded': return pr(P, ['cooldown'], 1.8);
    case 'shooter': return pr(P, ['cooldown', 'fireRate'], 1.7);
    case 'spread': return pr(P, ['cooldown', 'fireRate'], 2.1);
    case 'ring': return pr(P, ['cooldown', 'fireRate'], 2.6);
    case 'lobber': return pr(P, ['cooldown', 'fireRate'], 2.4);
    case 'summoner': return pr(P, ['summonInterval', 'cooldown', 'fireRate'], 5);
    case 'teleporter': return pr(P, ['teleportInterval', 'cooldown'], 3);
    case 'turret': return pr(P, ['cooldown', 'fireRate'], 1.4);
    case 'healer': return pr(P, ['healInterval', 'cooldown'], 3);
    default: return 1.5;
  }
}
const keepDist = (a: Agent) => pr(a.params, ['keepDistance'], a.ai === 'ring' ? 150 : a.role === 'support' ? 280 : a.ai === 'lobber' ? 240 : 220);
const needsToken = (a: Agent) => a.role !== 'support';

function enterRecover(w: AiWorld, a: Agent, ranged: boolean) {
  w.release(a); a.state = 'recover'; a.t = 0; a.vx = a.vy = 0;
  a.recoverDur = w.tune.recovery * (ranged ? RANGED_RECOVERY_MUL : 1);
  a.exposedT = a.recoverDur;
}

function thinkAgent(w: AiWorld, a: Agent, p: { x: number; y: number }, dt: number, rng: Rng): AiAction[] {
  const out: AiAction[] = []; a.t += dt; a.cd -= dt;
  const d = dist(a, p), an = ang(a, p); a.angle = an;
  const P = a.params;
  if (a.ai === 'shielded') { // shield turns toward the player, lowered during recovery
    const diff = wrapAngle(an - a.shieldAngle); a.shieldAngle += Math.sign(diff) * Math.min(Math.abs(diff), pr(P, ['turnSpeed'], 2.2) * dt * (a.state === 'recover' ? 0 : 1));
  }
  switch (a.state) {
    case 'recover':
      a.vx = a.vy = 0;
      if (a.t >= a.recoverDur) { a.state = 'idle'; a.t = 0; a.cd = Math.max(0.25, interval(a) - a.windup) * a.cdMul; if (a.role === 'ranged') { a.strafe = -a.strafe; a.strafeT = rng.range(1.2, 2.4); } }
      return out;
    case 'windup': {
      a.vx = a.vy = 0;
      if (a.t >= a.windup) { a.state = 'active'; a.t = 0; release(w, a, p, out, rng); }
      return out;
    }
    case 'active': activeTick(w, a, out); return out;
    case 'blink': { // teleporter: destination telegraphed, then emerge and aim
      a.vx = a.vy = 0;
      if (a.t >= a.activeDur) { out.push({ type: 'teleport', x: P._tx, y: P._ty }); a.x = P._tx; a.y = P._ty; a.state = 'windup'; a.t = 0; a.lock = ang({ x: P._tx, y: P._ty }, p); a.windup = Math.max(w.tune.windupMin, windupFor(w.tune, P.telegraph) * 0.8); out.push({ type: 'telegraphLine', angle: a.lock, length: 320, time: a.windup }); }
      return out;
    }
    case 'done': a.vx = a.vy = 0; return out;
  }
  // ---- idle: role movement + attack decision ----
  const ready = a.cd <= 0 && d <= attackRange(a) && w.hasLine(a, p);
  if (ready && (!needsToken(a) || w.acquire(a))) { startAttack(w, a, p, d, an, out, rng); return out; }
  if (ready) a.cd = 0.15; // waiting for a token: retry soon
  move(w, a, p, d, an, dt, rng);
  return out;
}

function move(w: AiWorld, a: Agent, p: { x: number; y: number }, d: number, an: number, dt: number, rng: Rng) {
  switch (a.role) {
    case 'static': a.vx = a.vy = 0; return;
    case 'rusher': {
      const engage = attackRange(a);
      if (a.cd <= 0.3 && w.canAttack(a)) { steer(a, an, a.ai === 'exploder' ? 1.1 : 1); return; } // go in
      const hold = Math.max(engage + 50, 105 + a.radius) + (a.ai === 'charger' ? -40 : 0);
      const fa = w.flankAngle(a, p);
      const tx = p.x + Math.cos(fa) * hold, ty = p.y + Math.sin(fa) * hold;
      steerTo(a, tx, ty, d < hold - 30 ? 0.7 : 0.85);
      return;
    }
    case 'tank': {
      // body-block: stand between the player and the nearest backline ally; otherwise press the player
      let best: Agent | null = null, bd = 420;
      for (const o of w.agents) if (o !== a && (o.role === 'ranged' || o.role === 'support' || o.role === 'static')) { const dd = dist(o, a); if (dd < bd) { bd = dd; best = o; } }
      if (best && d > 70) {
        const pa = ang(best, p); const gap = Math.min(110, dist(best, p) * 0.5);
        steerTo(a, best.x + Math.cos(pa) * gap, best.y + Math.sin(pa) * gap, 0.85);
      } else steer(a, an, d > attackRange(a) * 0.8 ? 0.8 : 0);
      return;
    }
    default: { // ranged & support: hold a distance band, strafe, reposition
      a.strafeT -= dt; if (a.strafeT <= 0) { a.strafe = -a.strafe; a.strafeT = rng.range(1.5, 3); }
      const keep = keepDist(a);
      let rad = 0; if (d > keep + 40) rad = 1; else if (d < keep - 40) rad = -0.9;
      const tang = rad === 0 ? 0.55 : 0.3;
      let vx = Math.cos(an) * rad + Math.cos(an + Math.PI / 2) * a.strafe * tang, vy = Math.sin(an) * rad + Math.sin(an + Math.PI / 2) * a.strafe * tang;
      // wall-aware: if the step leads out of the arena, flip the strafe and slide along
      if (!w.inBounds(a.x + vx * 40, a.y + vy * 40)) { a.strafe = -a.strafe; a.strafeT = rng.range(1, 2); vx = Math.cos(an + Math.PI / 2) * a.strafe * 0.6 + (rad > 0 ? Math.cos(an) : 0); vy = Math.sin(an + Math.PI / 2) * a.strafe * 0.6 + (rad > 0 ? Math.sin(an) : 0); }
      a.vx = vx * a.speed; a.vy = vy * a.speed;
    }
  }
}

function startAttack(w: AiWorld, a: Agent, p: { x: number; y: number }, d: number, an: number, out: AiAction[], rng: Rng) {
  const P = a.params; a.lock = an; a.t = 0; a.vx = a.vy = 0;
  a.windup = windupFor(w.tune, pr(P, TELE_KEYS[a.ai] ?? ['telegraph'], 0.5));
  a.state = 'windup';
  switch (a.ai) {
    case 'chaser': {
      const sp = pr(P, ['lungeSpeed', 'swoopSpeed'], 280); const L = Math.min(130, Math.max(60, d + 24));
      a.activeDur = L / sp; P._ls = sp;
      out.push({ type: 'telegraphLine', angle: an, length: L + a.radius, time: a.windup }); break;
    }
    case 'charger': {
      const sp = pr(P, ['chargeSpeed'], a.speed * 3.6); a.activeDur = pr(P, ['chargeDuration'], 0.45); P._ls = sp;
      out.push({ type: 'telegraphLine', angle: an, length: Math.min(520, sp * a.activeDur + a.radius), time: a.windup }); break;
    }
    case 'shielded': a.activeDur = 0.18; P._ls = 320; out.push({ type: 'telegraphLine', angle: an, length: 58 + a.radius, time: a.windup }); break;
    case 'exploder': out.push({ type: 'telegraphCircle', x: a.x, y: a.y, radius: pr(P, ['radius', 'aoeRadius', 'blastRadius'], 64), time: a.windup }); break;
    case 'shooter': case 'spread': out.push({ type: 'telegraphLine', angle: an, length: 360, time: a.windup }); break;
    case 'ring': out.push({ type: 'telegraphCircle', x: a.x, y: a.y, radius: a.radius + 34, time: a.windup }); break;
    case 'turret': {
      P._mode = P.spiralStep ? 2 : pr(P, ['bulletCount'], 1) > 1 ? 1 : rng.chance(0.3) ? 2 : 0;
      if (P._mode === 2) out.push({ type: 'telegraphCircle', x: a.x, y: a.y, radius: a.radius + 34, time: a.windup });
      else out.push({ type: 'telegraphLine', angle: an, length: 380, time: a.windup });
      break;
    }
    case 'lobber': { // the landing marker IS the telegraph: lob now, it lands after the windup
      const lx = p.x + rng.range(-20, 20), ly = p.y + rng.range(-20, 20);
      out.push({ type: 'lob', x: lx, y: ly, radius: pr(P, ['radius', 'aoeRadius'], 46), delay: a.windup });
      a.state = 'active'; a.activeDur = a.windup; break;
    }
    case 'summoner': case 'healer': out.push({ type: 'telegraphCircle', x: a.x, y: a.y, radius: a.radius + 26, time: a.windup }); break;
    case 'teleporter': {
      const r = rng.range(110, 170), th = rng.next() * Math.PI * 2;
      P._tx = Math.max(w.bounds.x0 + 40, Math.min(w.bounds.x1 - 40, p.x + Math.cos(th) * r)); P._ty = Math.max(w.bounds.y0 + 40, Math.min(w.bounds.y1 - 30, p.y + Math.sin(th) * r));
      if (w.nav && !w.nav.walkable(P._tx, P._ty)) { const f = w.nav.nearestFree(P._tx, P._ty); P._tx = f.x; P._ty = f.y; } // never emerge inside an obstacle
      a.state = 'blink'; a.activeDur = Math.max(0.5, a.windup);
      out.push({ type: 'telegraphCircle', x: P._tx, y: P._ty, radius: 22, time: a.activeDur }); break;
    }
  }
}
/** windup finished: the attack lands */
function release(w: AiWorld, a: Agent, p: { x: number; y: number }, out: AiAction[], rng: Rng) {
  const P = a.params;
  switch (a.ai) {
    case 'chaser': case 'charger': case 'shielded': a.vx = Math.cos(a.lock) * P._ls; a.vy = Math.sin(a.lock) * P._ls; return; // active body hit
    case 'exploder': out.push({ type: 'explode', radius: pr(P, ['radius', 'aoeRadius', 'blastRadius'], 64) }); a.state = 'done'; w.release(a); return;
    case 'shooter': { const n = pr(P, ['bulletCount', 'count'], 1); out.push({ type: 'shoot', angle: a.lock, speed: pr(P, ['bulletSpeed'], 200), count: n, spread: n > 1 ? 0.3 : 0, kind: 'arrow' }); break; }
    case 'spread': out.push({ type: 'shoot', angle: a.lock, speed: pr(P, ['bulletSpeed'], 180), count: pr(P, ['bulletCount', 'count'], 5), spread: pr(P, ['spreadDeg'], 50) * Math.PI / 180 }); break;
    case 'ring': out.push({ type: 'ring', count: pr(P, ['count', 'bulletCount'], 10), speed: pr(P, ['bulletSpeed'], 140), offset: rng.next() * Math.PI }); break;
    case 'turret': {
      if (P._mode === 2) { P._spin = (P._spin ?? 0) + (P.spiralStep ?? 22) * Math.PI / 180; out.push({ type: 'ring', count: P.spiralStep ? pr(P, ['bulletCount'], 4) : 8, speed: pr(P, ['bulletSpeed'], 130), offset: P._spin }); }
      else if (P._mode === 1) out.push({ type: 'shoot', angle: a.lock, speed: pr(P, ['bulletSpeed'], 200), count: pr(P, ['bulletCount'], 3), spread: pr(P, ['spreadDeg'], 40) * Math.PI / 180 });
      else out.push({ type: 'shoot', angle: a.lock, speed: pr(P, ['bulletSpeed'], 230), count: 1, spread: 0 });
      break;
    }
    case 'summoner': out.push({ type: 'summon', count: pr(P, ['count', 'summonCount'], 2) }); break;
    case 'healer': { const hp = pr(P, ['healPct'], 15); out.push({ type: 'heal', radius: pr(P, ['healRadius', 'radius'], 170), pct: hp > 1 ? hp / 100 : hp, amount: P.healAmount }); break; }
    case 'teleporter': out.push({ type: 'shoot', angle: a.lock, speed: pr(P, ['bulletSpeed'], 190), count: Math.min(3, pr(P, ['bulletCount'], 3)), spread: 0.5 }); break;
  }
  enterRecover(w, a, true);
}
function activeTick(w: AiWorld, a: Agent, out: AiAction[]) {
  void out;
  const P = a.params;
  if (MELEE_KINDS.includes(a.ai)) { a.vx = Math.cos(a.lock) * P._ls; a.vy = Math.sin(a.lock) * P._ls; }
  else a.vx = a.vy = 0;
  if (a.t >= a.activeDur) enterRecover(w, a, !MELEE_KINDS.includes(a.ai));
}

/** Shielded enemies block hits coming from their front 120° arc (not while recovering: shield lowered). */
export function shieldBlocks(a: Agent, from: { x: number; y: number }): boolean {
  if (a.ai !== 'shielded' || a.state === 'recover') return false;
  return Math.abs(wrapAngle(ang(a, from) - a.shieldAngle)) <= Math.PI / 3;
}

// ---------------- bosses ----------------
export type BossAction = AiAction
  | { type: 'laser'; angle: number; sweep: number; duration: number; width: number; beams: number; telegraph: number }
  | { type: 'mine'; x: number; y: number; radius: number; arm: number; life: number }
  | { type: 'shield'; duration: number; reflect: boolean }
  | { type: 'slam'; radius: number; telegraph: number; mult: number };
export interface BossBrain {
  phase: number; cd: number; cur: { atk: BossAttack; t: number; step: number; angle: number; tx?: number; ty?: number; lane?: number } | null;
  enraged: boolean; shieldT: number;
  /** v2 pacing */
  staggerT: number; recoverT: number; time: number; lastId: string | null; lastPattern: string | null; minesUntil: number;
}
export const newBrain = (): BossBrain => ({ phase: 0, cd: 1.2, cur: null, enraged: false, shieldT: 0, staggerT: 0, recoverT: 0, time: 0, lastId: null, lastPattern: null, minesUntil: 0 });
export function phaseFor(def: BossDef, hpRatio: number): number {
  let idx = 0; def.phases.forEach((ph, i) => { if (hpRatio <= ph.hpBelow + 1e-9) idx = i; }); return idx;
}
export function ringAngles(count: number, offset = 0): number[] { return Array.from({ length: count }, (_, i) => offset + (i / count) * Math.PI * 2); }
export const BOSS_PATTERNS = ['ring', 'spiral', 'crossWave', 'cross', 'aimedBurst', 'aimed', 'charge', 'summon', 'hazard', 'rainMarkers', 'slam', 'minefield', 'laserSweep', 'shieldPhase', 'teleportStrike'];
/** patterns that leave lingering area denial: never two in a row */
export const AREA_PATTERNS = ['hazard', 'rainMarkers', 'minefield', 'laserSweep'];
/** rings with at least this many bullets leave a safe lane of SAFE_LANE bullets */
export const SAFE_LANE_MIN = 14, SAFE_LANE = 2;

/** Pattern sequencing: no immediate repeat, no two area-denial patterns back-to-back, no new minefield while mines live. */
export function pickBossAttack(b: BossBrain, attacks: BossAttack[], rng: Rng): BossAttack {
  const rules: Array<(a: BossAttack) => boolean> = [
    (a) => attacks.length < 2 || a.id !== b.lastId,
    (a) => !(a.pattern === 'minefield' && b.time < b.minesUntil),
    (a) => !(b.lastPattern && AREA_PATTERNS.includes(b.lastPattern) && AREA_PATTERNS.includes(a.pattern)),
  ];
  let cands = attacks;
  for (const r of rules) { const next = cands.filter(r); if (next.length) cands = next; }
  return rng.weighted(cands, (x) => x.weight);
}

export function bossThink(b: BossBrain, def: BossDef, hpRatio: number, me: Agent, p: { x: number; y: number }, arena: { w: number; h: number }, dt: number, rng: Rng, w: AiWorld = FREE_WORLD): BossAction[] {
  const out: BossAction[] = [];
  const tune = tuneFor(def.chapter, w.hard);
  b.time += dt;
  if (b.shieldT > 0) b.shieldT = Math.max(0, b.shieldT - dt);
  if (me.exposedT > 0) me.exposedT = Math.max(0, me.exposedT - dt);
  const ph = phaseFor(def, hpRatio);
  if (ph !== b.phase) {
    b.phase = ph; b.cur = null; w.release(me);
    b.staggerT = tune.bossStagger; me.exposedT = b.staggerT; b.cd = 0.6; b.recoverT = 0;
    const pd = def.phases[ph]; out.push({ type: 'phase', index: ph, onEnter: pd.onEnter, summon: pd.summon });
    if (pd.onEnter === 'enrage') b.enraged = true;
  }
  if (!b.enraged && hpRatio <= tune.enrageAt) { b.enraged = true; out.push({ type: 'enrage' }); }
  const phase = def.phases[b.phase];
  if (!b.cur) {
    if (b.staggerT > 0) { b.staggerT = Math.max(0, b.staggerT - dt); me.vx = me.vy = 0; return out; }
    if (b.recoverT > 0) { b.recoverT = Math.max(0, b.recoverT - dt); me.vx = me.vy = 0; return out; }
    const an = ang(me, p); const d = dist(me, p); const mv = b.enraged ? 1.15 : 1;
    if (d > 150) steer(me, an, 0.6 * mv); else steer(me, an + Math.PI / 2, 0.4 * mv);
    b.cd -= dt / (b.enraged ? tune.enrageCdMul : 1);
    if (b.cd <= 0 && phase.attacks.length) { const atk = pickBossAttack(b, phase.attacks, rng); b.cur = { atk, t: 0, step: 0, angle: an }; w.force(me); }
    return out;
  }
  const c = b.cur; const P = c.atk.params; c.t += dt; me.vx = me.vy = 0; // telegraphs are never sped up (enrage only shortens cooldowns)
  const done = (cool = 1.0) => {
    b.cur = null; b.cd = cool; b.recoverT = tune.bossRecovery; me.exposedT = Math.max(me.exposedT, b.recoverT);
    b.lastId = c.atk.id; b.lastPattern = c.atk.pattern; w.release(me);
  };
  const tmin = tune.bossTeleMin;
  const tele = Math.max(tmin, pr(P, ['telegraph'], 0));
  switch (c.atk.pattern) {
    case 'ring': {
      const waves = pr(P, ['waves', 'bursts'], 1), gap = pr(P, ['waveGap', 'burstGap'], 0.45), count = pr(P, ['count'], 12);
      if (c.step === 0 && c.t < tele) { if (c.tx === undefined) { c.tx = 1; out.push({ type: 'telegraphCircle', x: me.x, y: me.y, radius: 70, time: tele }); } break; }
      const t0 = c.t - tele;
      if (t0 >= c.step * gap && c.step < waves) {
        const offset = c.angle + c.step * (Math.PI / count);
        if (count >= SAFE_LANE_MIN) { // leave a dodge lane (rotates per wave)
          const lane = Math.floor(rng.next() * count);
          ringAngles(count, offset).forEach((a, i) => { if (((i - lane + count) % count) >= SAFE_LANE) out.push({ type: 'shoot', angle: a, speed: pr(P, ['speed'], 150), count: 1, spread: 0, kind: 'orb' }); });
        } else out.push({ type: 'ring', count, speed: pr(P, ['speed'], 150), offset, kind: 'orb' });
        c.step++;
      }
      if (c.step >= waves) done(); break;
    }
    case 'spiral': {
      if (c.t < tmin) { if (c.tx === undefined) { c.tx = 1; out.push({ type: 'telegraphCircle', x: me.x, y: me.y, radius: 60, time: tmin }); } break; }
      const rate = pr(P, ['rate'], 12), dur = pr(P, ['duration'], (pr(P, ['shots'], 24)) / 12), arms = pr(P, ['arms'], 3), turn = pr(P, ['turnDeg'], 15) * Math.PI / 180;
      const shots = Math.round(rate * dur); const t1 = c.t - tmin;
      while (t1 >= c.step / rate && c.step < shots) { out.push({ type: 'ring', count: arms, speed: pr(P, ['speed'], 150), offset: c.angle + c.step * turn, kind: 'star' }); c.step++; }
      if (c.step >= shots) done(1.2); break;
    }
    case 'cross': case 'crossWave': {
      if (c.t < tmin) { if (c.tx === undefined) { c.tx = 1; out.push({ type: 'telegraphCircle', x: me.x, y: me.y, radius: 60, time: tmin }); } break; }
      const waves = pr(P, ['waves'], 3), gap = pr(P, ['waveGap'], 0.5), arms = pr(P, ['arms'], 4), rot = pr(P, ['rotateDeg'], 45) * Math.PI / 180, cnt = pr(P, ['count'], 5);
      const t1 = c.t - tmin;
      if (t1 >= c.step * gap && c.step < waves) { for (const a of ringAngles(arms, c.step * rot)) out.push({ type: 'shoot', angle: a, speed: pr(P, ['speed'], 200), count: Math.min(cnt, 3), spread: 0.12 }); c.step++; }
      if (c.step >= waves) done(); break;
    }
    case 'aimed': case 'aimedBurst': {
      const n = pr(P, ['bursts'], 3), gap = pr(P, ['burstGap'], 0.3);
      if (c.t < tele) { if (c.tx === undefined) { c.tx = 1; c.angle = ang(me, p); out.push({ type: 'telegraphLine', angle: c.angle, length: 420, time: tele }); } break; }
      if (c.t - tele >= c.step * gap && c.step < n) { const a0 = c.step === 0 ? c.angle : ang(me, p); out.push({ type: 'shoot', angle: a0, speed: pr(P, ['speed'], 220), count: pr(P, ['count'], 3), spread: P.spreadDeg != null ? P.spreadDeg * Math.PI / 180 : pr(P, ['spread'], 0.4) }); c.step++; }
      if (c.step >= n) done(0.9); break;
    }
    case 'charge': {
      const wu = Math.max(tmin, pr(P, ['windup', 'telegraph'], 0.8)), dur = pr(P, ['duration'], 0.6), n = pr(P, ['count'], 1);
      const cyc = wu + dur + 0.25; const k = Math.floor(c.t / cyc), local = c.t - k * cyc;
      if (k >= n) { done(1.0); break; }
      if (c.step === k * 2 && local >= 0) { c.angle = ang(me, p); out.push({ type: 'telegraphLine', angle: c.angle, length: Math.min(700, pr(P, ['speed'], 380) * dur + 60), time: wu }); c.step++; }
      else if (c.step === k * 2 + 1 && local >= wu) { out.push({ type: 'charge', angle: c.angle, speed: pr(P, ['speed'], 380), duration: dur }); c.step++; }
      break;
    }
    case 'summon': out.push({ type: 'summon', count: pr(P, ['count'], 2), ids: phase.summon }); done(1.6); break;
    case 'hazard': case 'rainMarkers': {
      const dl = Math.max(tmin, pr(P, ['delay', 'telegraph'], 1));
      if (c.step === 0) {
        const n = pr(P, ['count'], 5), r = pr(P, ['radius'], 48), area = pr(P, ['area'], 0);
        out.push({ type: 'hazard', x: p.x, y: p.y, radius: r, delay: dl });
        for (let i = 1; i < n; i++) {
          const x = area ? p.x + rng.range(-area / 2, area / 2) : rng.range(60, arena.w - 60), y = area ? p.y + rng.range(-area / 2, area / 2) : rng.range(80, arena.h - 60);
          out.push({ type: 'hazard', x: Math.max(40, Math.min(arena.w - 40, x)), y: Math.max(60, Math.min(arena.h - 40, y)), radius: r, delay: dl });
        }
        c.step = 1;
      } else if (c.t >= dl + 0.3) done(0.9);
      break;
    }
    case 'slam': {
      const tl = Math.max(tmin, pr(P, ['telegraph'], 0.9));
      if (c.step === 0) { out.push({ type: 'slam', radius: pr(P, ['radius'], 110), telegraph: tl, mult: pr(P, ['damageMul'], 1.2) }); c.step = 1; }
      else if (c.t >= tl + 0.3) done(0.9);
      break;
    }
    case 'minefield': {
      const life = pr(P, ['life'], 8);
      for (let i = 0; i < pr(P, ['count'], 8); i++) {
        let x = rng.range(60, arena.w - 60), y = rng.range(90, arena.h - 60);
        if (Math.hypot(x - p.x, y - p.y) < 70) { x = Math.max(60, Math.min(arena.w - 60, x + (x < p.x ? -90 : 90))); } // never arm a mine under the player
        out.push({ type: 'mine', x, y, radius: pr(P, ['radius'], 42), arm: Math.max(tmin, pr(P, ['armTime'], 0.9)), life });
      }
      b.minesUntil = b.time + life;
      done(1.4); break;
    }
    case 'laserSweep': {
      const tl = Math.max(tmin, pr(P, ['telegraph'], 0.8)), dur = pr(P, ['duration'], 2);
      if (c.step === 0) { c.angle = ang(me, p) - (pr(P, ['sweepDeg'], 180) * Math.PI / 360); out.push({ type: 'laser', angle: c.angle, sweep: pr(P, ['sweepDeg'], 180) * Math.PI / 180, duration: dur, width: pr(P, ['width'], 28), beams: pr(P, ['beams'], 1), telegraph: tl }); c.step = 1; }
      else if (c.t >= tl + dur) done(1.0);
      break;
    }
    case 'shieldPhase': {
      if (c.step === 0) { out.push({ type: 'shield', duration: pr(P, ['duration'], 3), reflect: pr(P, ['reflect'], 0) > 0 }); b.shieldT = pr(P, ['duration'], 3) + pr(P, ['telegraph'], 0.6); c.step = 1; }
      else if (c.t >= 0.8) done(0.6);
      break;
    }
    case 'teleportStrike': {
      const n = pr(P, ['count'], 2), gap = pr(P, ['gap'], 0.4), wu = Math.max(tmin, pr(P, ['telegraph'], 0.6)), r = pr(P, ['radius'], 70);
      const cyc = wu + gap; const k = Math.floor(c.t / cyc), local = c.t - k * cyc;
      if (k >= n) { done(1.0); break; }
      if (c.step === k * 2) { c.tx = Math.max(60, Math.min(arena.w - 60, p.x + rng.range(-30, 30))); c.ty = Math.max(90, Math.min(arena.h - 60, p.y + rng.range(-30, 30))); out.push({ type: 'telegraphCircle', x: c.tx, y: c.ty, radius: r, time: wu }); c.step++; }
      else if (c.step === k * 2 + 1 && local >= wu) { out.push({ type: 'teleport', x: c.tx!, y: c.ty! }); out.push({ type: 'slam', radius: r, telegraph: 0, mult: 1.1 }); c.step++; }
      break;
    }
    default: done(0.5);
  }
  return out;
}
