# Tháp Sao v2 — Enemy & boss AI depth, encounter design

_Workstream: enemy/boss AI + encounters (2026-10-10). No new enemies, bosses or items: every change re-uses the 30 enemies
and 12 bosses in `src/data/`._

Code: `src/systems/ai.ts` (AI kit, `AiWorld`, bosses), `src/systems/director.ts` (encounters + elites),
`src/systems/difficulty.ts` (per-chapter tune table — the numbers below), `src/systems/status.ts` (Exposed),
`src/systems/floorgen.ts` (`planWaves` now delegates to the director). Scene glue in `src/scenes/RunScene.ts` is
limited to: one `AiWorld` per room (`aiw`), the think call, contact gating, elite promotion/marker, splitting on death,
windup flash / Exposed tint + status dot, 'Choáng!' on phase change, 'Cuồng nộ!' on enrage.
Tests: `tests/ai_v2.test.ts`, `tests/boss_v2.test.ts`, `tests/director.test.ts` (+ updated `tests/ai.test.ts`).

## 1. Attack rhythm: telegraph → active → recovery (punish) → cooldown
Every enemy attack is a state machine: **idle → windup → active → recover → idle**.
- **Windup** = `max(0.4 s, chapter windupMin, content telegraph × chapter windupMul)` (`windupFor`). The enemy stops,
  flashes red/white, and a telegraph is drawn: aim line (shooter, spread, turret shot, teleporter after emerging),
  lunge/charge/bash line at the *locked* angle (chaser, charger, shielded), circle on self (ring, turret ring, exploder
  fuse, summoner, healer), destination circle (teleporter blink). The attack direction is locked at windup start, so
  side-stepping or dashing dodges it.
- Lobbers: the landing marker is the telegraph; it lands after the windup time.
- **Active**: melee kinds (chaser lunge, charger dash, shielded bash) deal **contact damage only during these frames**
  (`contactMult`); idle bodies no longer hurt on touch. Bosses hurt on contact only while charging (×1.4).
- **Recovery**: the enemy stands still and is **Exposed** (+25% damage taken, `EXPOSED_TAKEN`, gold status dot +
  pale-gold tint). Melee recovery = chapter `recovery`, ranged = 60 % of it. Shielded enemies **lower the shield**
  during recovery (front hits land fully).
- Stun/freeze during windup cancels the attack (no damage) and frees its token.

## 2. Attack tokens (positioning, not chaos)
`AiWorld` owns a pool of **N tokens per room** (table). An enemy must hold one to enter windup; it is released when the
attack resolves (entering recovery). Two attack starts are always at least `attackGap` apart, so windups never fire on
the same frame. Swarm members (bees) and turrets cost 0.5. Supports (summoner, healer) need no token. A boss holds a
token for the whole pattern, so minions get one fewer. Dead agents are pruned every frame.

## 3. Roles (from the existing AiKind)
| Role | Kinds | Behaviour |
|---|---|---|
| Rusher | chaser, charger, exploder | Without a token: hold a ring ~110–270 px around the player and **spread around them** (angular repulsion between rushers → flank/surround). With a token and cooldown ready: go in, windup, strike. |
| Ranged | shooter, spread, ring, lobber, teleporter | Keep a distance band (`keepDistance` ± 40), strafe, flip direction every 1.5–3 s and after each attack (reposition), wall-aware (flip when the next step leaves the arena). |
| Tank | shielded | **Body-blocks**: stands between the player and the nearest ranged/support/turret ally; presses the player when none. Shield tracks the player except in recovery. |
| Support | summoner, healer | Ranged band at ~280 px; telegraphed casts, no token. |
| Static | turret | Telegraphed shot / spread (steam turret) / rotating spiral ring (quill turret uses `spiralStep`). |
All agents use steering **separation** (radius + 12 px, deterministic tie-break when spawned on one point), on top of
the scene's positional push-out, so enemies never stack.

## 4. Encounter director
`planEncounter` builds each combat room:
- **Waves**: 2 or 3 (chance of 3 grows with global floor and depth), arena event 3–4.
- **Budget per wave** = chapter `waveBudget` + 0.75·(floor−1) + 0.75·depth + 1·waveIndex. Costs: regular 1.5, swarm
  group 2.5, support 2, tank 3, data-elite (snow golem, piston brute, star knight) 3.
- **Role mix** target rusher 45 % / ranged 33 % / tank 10 % / static 7 % / support 5 %, caps per wave: ≤1 support,
  ≤1 turret, ≤1 tank (2 from ch4 when ≥6 enemies), ranged ≤ half. Every wave opens with a rusher. ≤ 9 entries.
- **Elites** (existing enemies + affix, never swarms or data-elites, none in mini-boss rooms, none on ch1 floor 1):
  ≤1 per wave (2 in the last wave from ch5); the arena's last wave and derangement rooms' last wave always have one.
  Elites get ×2 HP, ×1.2 damage, ×1.2 size, a **pulsing coloured ground ring + label** above the HP bar:
  | Affix | Label | Effect |
  |---|---|---|
  | swift | Tinh Anh · Nhanh | +35 % move speed, −25 % cooldowns (windups unchanged) |
  | shielded | Tinh Anh · Giáp | 40 % armor (defense) |
  | splitting | Tinh Anh · Phân Tách | ×1.7 HP; on death splits into 2 smaller copies at 35 % of its max HP |
  | volatile | Tinh Anh · Nổ | explodes on death (existing telegraphed 0.6 s death blast) |
  Tanks can roll shielded/volatile; turrets shielded/splitting; exploders no volatile.
- `planWaves` keeps its old shape (`waves: string[][]`) and adds `elites` aligned per wave/entry.

## 5. Bosses
- **Phase transition**: current pattern cancelled, **stagger** (no attacks, no movement, Exposed) for `bossStagger`,
  'Choáng!' over the boss; then the phase's summons/onEnter hook as before.
- **Recovery** after every pattern (`bossRecovery`, Exposed, standing still) → the punish window.
- **Sequencing** (`pickBossAttack`): never the same attack twice in a row; never two area-denial patterns
  (rain markers / hazard / minefield / laser sweep) back-to-back; no new minefield while the previous mines live.
- **Enrage** at ≤ `enrageAt` HP (or the content's `onEnter: 'enrage'` phase): 'Cuồng nộ!' toast, cooldowns ×
  `enrageCdMul`, movement ×1.15. **Telegraphs are never shortened** (v1 sped up the whole pattern clock).
- **Dodgeable**: every damaging pattern lands ≥ `bossTeleMin` after it starts (spiral and cross waves now open with a
  telegraph circle, aimed bursts with an aim line on the first burst, ring/charge/slam/laser/teleport-strike floors);
  rings of ≥ 14 bullets leave a 2-bullet **safe lane**; mines never arm under the player. All hazard damage is a single
  instant or a sweeping beam, which the 0.18 s dash i-frames (or dashing across a ≤ 32 px beam) clear.
- **Killable by real damage**: boss HP is unchanged; the modeled time-to-kill (below) is 29–37 s for a normal run's
  level (`tests/boss_v2.test.ts` asserts 20–90 s for all six). Model: level L = 3 + 3·(ch−1), element damage
  20 + 2·(L−1), +15 %/chapter from items, Kiếm & Khiên at 45 % uptime, shield phases discounted.

### Smoke bot
`tools/smoke.mjs` now gives the bot the same normal-run level before each boss (a chapter jump skips earlier XP), and
fights each boss to the death (≤ 150 s, god mode). `__TS.killBoss()` is only a logged fallback
(`NOTE boss_chN_real_kill … fallback`); the summary line `boss real kills x / 6` reports how many died to real damage.
Not run in this workstream (integration pass runs the smoke).

## 6. Difficulty curve per chapter
Enemy HP/damage multipliers are the existing data scales (`src/data/enemies.ts`) times the per-floor scale
(`enemyScale`, +6 % HP / +4 % dmg per global floor); hard mode ×1.4 both, +1 token, windups ×0.92 (still ≥ 0.4 s),
+10 % elite chance. Bodies/room counts a bee swarm as 3.

| Ch | Enemy HP× / dmg× (data) | Floor scale f1→f3 (HP / dmg) | Windup min | Windup × | Recovery melee / ranged | Tokens | Attack gap | Wave budget f1·d0·w1 → f3·d2·w3 | Elite % f1·d0 → f3·d2 | Bodies/room f1·d0 / f2·d1 / f3·d2 | Boss HP | Boss tele min | Boss recovery | Stagger | Enrage at / cd× | Modeled boss TTK |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 1 / 1 | 1.00–1.12 / 1.00–1.08 | 0.6 s | 1.2 | 0.75 / 0.45 s | 2 | 0.45 s | 2.75 → 7.75 ¹ | 0 → 20 | 5.1 / 9.1 / 12.9 ¹ | 1100 | 0.6 s | 0.8 s | 1.5 s | 20% / 0.75 | 29 s (L3) |
| 2 | 1.5 / 1.35 | 1.18–1.30 / 1.12–1.20 | 0.55 s | 1.1 | 0.7 / 0.42 s | 2 | 0.4 s | 4 → 9 | 10 → 30 | 6.5 / 9.1 / 12.3 | 1600 | 0.55 s | 0.75 s | 1.4 s | 20% / 0.72 | 29 s (L6) |
| 3 | 2.2 / 1.75 | 1.36–1.48 / 1.24–1.32 | 0.5 s | 1.05 | 0.65 / 0.39 s | 3 | 0.35 s | 5 → 10 | 15 → 35 | 9.1 / 12.6 / 16.5 | 2200 | 0.5 s | 0.7 s | 1.3 s | 22% / 0.7 | 30 s (L9) |
| 4 | 3.1 / 2.2 | 1.54–1.66 / 1.36–1.44 | 0.48 s | 1 | 0.6 / 0.36 s | 3 | 0.32 s | 5.5 → 10.5 | 20 → 40 | 9.8 / 13.2 / 15.7 | 3000 | 0.48 s | 0.65 s | 1.25 s | 22% / 0.68 | 31 s (L12) |
| 5 | 4.3 / 2.75 | 1.72–1.84 / 1.48–1.56 | 0.45 s | 0.95 | 0.55 / 0.33 s | 3 | 0.28 s | 6 → 11 | 25 → 45 | 11.0 / 13.5 / 15.9 | 4000 | 0.45 s | 0.6 s | 1.2 s | 25% / 0.65 | 33 s (L15) |
| 6 | 6 / 3.4 | 1.90–2.02 / 1.60–1.68 | 0.42 s | 0.9 | 0.5 / 0.30 s | 4 | 0.25 s | 6.5 → 11.5 | 30 → 50 | 12.3 / 14.8 / 17.2 | 5600 | 0.42 s | 0.55 s | 1.1 s | 25% / 0.62 | 37 s (L18) |

¹ Integration pass: ch1 `waveBudget` 3.5 → 2.75 and ch1 floor 1 always exactly 2 waves (was 3.5 → 8.5, 6.9 / 10.8 / 15.3 bodies). See `docs/STATUS.md`.

## 7. Risks / follow-ups
- Pacing is slower per enemy (windup + recovery per attack) but rooms field more bodies (2–3 waves). Balance by play.
- Chasers/tanks no longer hurt on idle contact; a passive bump damage could be re-added at low % if fights feel too safe.
- Shooter aim lines reuse the charge telegraph art (`fx_telegraph_line`, width = 1.6 × radius); a thinner aim line art
  would read better.
- The status dot for Exposed shows only once an enemy is damaged (HP bar hidden at full HP); the tint shows always.
