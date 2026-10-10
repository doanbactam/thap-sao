# V2 — Character animation readability

Owner: animation/perf workstream. Code: `src/game/heroAnim.ts` (hero rig), `src/game/enemyAnim.ts` (enemy poses).
No new art: everything is built on the existing sheets (`hero_*`, `wpn_*`, `en_*`) + two tiny runtime textures
(the paw `hero_paw_<rgb>`, generated from the costume's body colour).

## Hero rig (`HeroRig`, created in `RunScene.spawnHero`)
The hero sheet has tiny baked arms, so the weapon now lives on a **hand pivot**: a container holding a cartoon paw
(cream fill, thick `#3B2416` outline, sampled body colour per costume) with the weapon image's grip on it. The rig
owns, every frame (`rig.update(dt, input)` from `RunScene.updatePlayer`, so hit-stop freezes the pose too):

| Feature | What it does |
|---|---|
| Hand pivot | grip at the hand (±7 px forward, 17 px up), weapon rotates around the paw; depth flips behind the body when aiming up |
| Rest pose | melee: forward-down + idle bob / run swing; crossbow: aimed level; staff: held upright (orb up) |
| Attack arc | `slash`/`heavy` wind past the arc start, then sweep through the real arc (alternating sweep each hit, or the move's `sweep`); `thrust`/`stab` pull back then extend (+25 % weapon stretch); `shoot` recoil kick + tip up; `cast` raise overhead → point at target → settle; `bash` shove forward; `spin` follows `facing` |
| Anticipation | the wind-up pose = the move's real `startup` (combat-feel frame data); 30 ms default for 0-startup melee, 45 ms for casts |
| Squash & stretch | under-damped spring on body scale: crouch on wind-up, stretch on the strike frame (heavier for `heavy`/finishers), dash stretch along the dash axis, hurt squash; charge (hold) slowly squashes + weapon trembles |
| Dash | stretch + pooled afterimages (max 6 images, cyan FILL tint, 200 ms fade, one every 35 ms) |
| Hurt | squash + 5 px recoil away from the source + rotation wobble (220 ms) |
| Facing turn | flipping left/right runs a 90 ms narrow→full scaleX "turn" instead of an instant mirror |
| Lean | ±0.07 rad lean into horizontal movement |
| Guard | shield (`wpn_shield`, sword-and-shield only) swings to the front and grows while guarding |

Weapon display scale multipliers (tiny art reads better in hand): `WEAPON_SCALE = { dagger 1.35, katana 1.1, swordshield 1.1 }`.

### Automatic sync with combat-feel
`rig.update` receives `combat: rs.cs` (the `CombatState` from `src/systems/combat.ts`). Every new move (phase leaves
`idle`, or `t` resets inside a chain) auto-plays the pose: kind from `WEAPON_ANIM[weapon]` (finisher kind for
finishers), wind-up = `move.startup × scale`, duration ≈ `max(weapon ms, startup + 0.7 × recovery)`, `sweep = move.sweep`,
power 1.5 on finishers. So **combat-feel does not need to call anything for light/charged attacks**.

### API (for combat-feel, specials, spells)
```ts
import { playAttack, playDash, playHurt, playCast, heroRig, WEAPON_ANIM } from '../game/heroAnim';
playAttack(scene, kind, arcDeg, durationMs, opts?)
//   kind: 'slash' | 'heavy' | 'thrust' | 'stab' | 'shoot' | 'cast' | 'bash' | 'spin'
//   opts: { windupMs?, sweep?: 1 | -1, angle?: rad, reach?: px, power?: 0..2 }
playDash(scene, angleRad, durationMs = 180)   // called from RunScene.startDash
playHurt(scene, fromAngleRad?)                 // called from RunScene.hurtPlayer
playCast(scene, durationMs = 260)              // called from RunScene.castSpellSlot
heroRig(scene)?.busy                            // true while an attack pose runs
```
Suggested calls for specials (not wired by this workstream — RunScene `updateSpecial` belongs to combat-feel):
shield bash `playAttack(rs,'bash',0,260,{power:1.4})`, katana iaido `playAttack(rs,'thrust',20,260,{reach:22,power:1.6})`,
staff nova `playCast(rs,300)`, crossbow piercing shot `playAttack(rs,'shoot',0,220,{power:1.5})`.

Notes for combat-feel: `combatFx.ts` still sets `rs.wpn.setRotation(...)` during startup and spawns its own dash ghost;
both are harmless (the rig re-poses the weapon after `CFX.frame`, ghosts just double up) and can be removed.

## Enemy poses (`src/game/enemyAnim.ts`) — for the AI layer
```ts
import { enemyWindup, enemyRecover, enemyPoseClear, syncEnemyPose } from '../game/enemyAnim';
enemyWindup(sprite, ms, { strength?, color? })  // crouch 40 % → swell (+10 % / +12 %), back-lean, additive red glow
                                                 // pulsing faster, full white flash in the last 70 ms
enemyRecover(sprite, ms = 450, { strength? })    // punish window: slumped (wide/short), blue-grey dim, slow wobble
enemyPoseClear(sprite)                           // cancel (stun, death, interrupt)
syncEnemyPose(sprite, agent, disabled?, strength?) // one call per enemy per frame: starts the right pose on
                                                 // agent.state → 'windup' (agent.windup s) / 'recover' (agent.recoverDur s)
```
Applied in the scene's `POST_UPDATE` (after RunScene positioned / tinted / flipped the sprite, before render), so it
composes with the per-frame tint code; a hit flash (FILL tint) wins over the pose tint. Original scale and rotation
are restored when the pose ends. No tweens; one `Map` per scene. Suggested strength: 1 normal, 1.3 elite, 0.6 boss.
`window.__TSAnim` exposes the four functions for tools/probes.

## Checking it
`node tools/anim-shots.mjs <dist> swordshield,greatsword` steps the game loop manually (1/60 s) and crops the hero
every N frames through a 3-hit chain, a dash and a hit → `python3 tools/anim-sheet.py` writes `out/anim/<weapon>.png`.
