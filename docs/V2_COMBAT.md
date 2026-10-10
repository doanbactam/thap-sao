# V2 — Combat feel & player skill expression

Workstream scope: optimize existing combat (no new weapons, enemies, items or artifacts). Full frame data: `docs/COMBAT.md`.

## What changed
| Area | Change | Where |
|---|---|---|
| Frame data | Every melee light hit now has startup → strike → chain window → dash-cancel window → recovery, per hit and per weapon; alternating swing direction; finisher with bigger reach/arc, lunge, knockback, poise damage | `src/systems/combat.ts` (`LIGHT`), `weapons.ts` `tryAttack` (cooldown = startup + chain window) |
| Input buffer | Attack and dash presses are buffered 120 ms (game time, survives hit-stop frames). Attack press is latched in `Controls` (mouse, J, touch button, simulated edge) | `combat.ts` `stepAttack`/`takeDash`, `src/game/input.ts` `takeAttackPress` |
| Cancels | Dash cancels startup (feint weapons), recovery after the dash-cancel window, and charging; a dash pressed early fires as soon as the window opens. Guard drops a pending wind-up | `combat.ts` `canDash`, `onDash`, `cancelStartup` |
| Commitment | Move slow during startup/recovery (Greatsword ×0.2, Dagger ×0.9); Greatsword angle locked at press, no feint, super armor (others lose the strike if hit during startup) | `combat.ts` `moveMul`, `onHurt` |
| Charged attack | Hold attack ≥ 280 ms → charge ring; release ≥ 35% → per-weapon charged attack (S&S wide 180° bash-slash, Greatsword 224° heavy cleave, Dagger long crit thrust, Katana crescent, Crossbow piercing heavy bolt, Staff big piercing orb). Full charge auto-releases after 350 ms (touch-safe) | `combat.ts` `CHARGED`, `weapons.ts` `tryCharged`/`canCharge`/`chargedFor`, `combatFx.ts` `attackInput` |
| Dash / perfect dodge | i-frames = 230 ms with a cyan tint for exactly that window. A real threat within 120 ms of dash start = "Né hoàn hảo!": ghost afterimage, slow-mo ×0.3 for 350 ms, next hit +50% within 1.5 s (1 s cooldown) | `combat.ts` `tryPerfectDodge`, `combatFx.ts` `dodged`, RunScene `update` (dt × `timeScale`) |
| Parry | Perfect guard keeps the 150 ms window; spam lockout 350 ms; melee parry staggers + shoves the attacker, riposte (next hit crits within 1.2 s); projectile parry **reflects** the projectile (×1.5 dmg) | `combat.ts` `guardOpen/guardClose/onParry`, `combatFx.ts` `parried`/`reflect` |
| Impact | Per-hit hit-stop scaled by damage share / crit / finisher / charged (cap 120 ms, max not sum); 4 shake tiers; poise + weight knockback with stagger on break; directional sparks reusing `fx_hit`/`fx_crit`/`fx_slash_small` | `combat.ts` `hitStopFor`, `shakeTierFor`, `damagePoise`, `knockImpulse`; `combatFx.ts` `impact` |
| HUD | No HUD change. Only a small world-space charge ring above the hero while charging (dash pips already show dash readiness) | `combatFx.ts` `drawCharge` |
| Strings | `combat.perfectDodge` "Né hoàn hảo!", `combat.stagger` "Choáng!", `combat.chargeFull` "Tụ đầy!", `combat.reflect` "Phản đạn!", `combat.perfectParry` | `src/data/strings.ts` |
| Tests | `tests/combat.test.ts` (32 tests): frame data ordering/identity, buffer, hold/charge/overcharge, cancel windows, super armor, perfect dodge, parry lockout/riposte, poise/weight, hit-stop/shake | |

### RunScene hooks (all small, localized)
`import`s; field `cs` + `strikeCtx`; `init` resets them; `update`: `let dt`, `tickReal` + slow-mo scale after the hit-stop early return;
`updatePlayer`: `CFX.frame(this, dt)` after `tickWeapon`, dash condition → `takeDash(...)`, guard open/close → `guardOpen/guardClose`,
move speed × `moveMul(...)`, `if (c.attack) this.doAttack()` → `CFX.attackInput(this, dt)`; `startDash` calls `onDash`;
`doAttack` split into `doAttack` (tryAttack + `beginMove`) and `strike(p)` (lunge/range/arc from frame data, strike context for bonuses);
`meleeHit` no longer sets a flat 45 ms hit-stop; `swingFx` takes a sweep direction; `hitEnemy` adds strike bonuses to `computeDamage`
and replaces the old spark/crit-shake/knockback lines with `CFX.impact(...)`; `hurtPlayer` calls `CFX.dodged` on i-frame bail-out,
`CFX.parried` on perfect guard (replaces the inline 1.2 s stun) and `onHurt` after damage; enemy projectile: perfect guard → `CFX.reflect`,
dash pass-through → `CFX.dodged`.

## Tuning numbers (100% attack speed)
| Weapon | Identity | Light chain DPS (coef/s, full chain) | v1 | Charged |
|---|---|---|---|---|
| Kiếm & Khiên | balanced, guard-cancel, parry | 3.4 / 1.06 s = 3.2 | 2.95 | 2.2, 500 ms |
| Đại Kiếm | reach, commitment, super armor, breaks poise every hit | 4.2 / 1.48 s = 2.84 | 2.6 | 3.4, 800 ms |
| Dao Găm | speed, no startup, dash anytime | 2.9 / 0.71 s = 4.1 | 3.94 | 2.0 +25% crit, 350 ms |
| Kiếm Cong | precision, long finisher thrust (lunge 50) | 3.7 / 1.02 s = 3.63 | 3.43 | 2.5, 550 ms |
| Nỏ / Gậy Phép | v1 cadence unchanged | — | — | 2.6 pierce+3 / 2.4 pierce+2 |
Melee chain DPS is +4–9% vs v1 to pay for the added startup and the lower knockback on non-breaking hits.
Constants: buffer 120 ms, hold delay 280 ms, min charge 35%, overcharge 350 ms, dash i-frames 230 ms, perfect dodge 120 ms /
cd 1 s / slow-mo ×0.3 for 350 ms / +50% for 1.5 s, parry lockout 350 ms, riposte 1.2 s, stagger 450 ms, poise regen 1.2 s.

## Verification
- `npm run typecheck` clean; `tests/combat.test.ts`, `tests/weapons.test.ts`, `tests/i18n.test.ts` pass.
- Headless probe on a private build (`/tmp/dist_combat`, not the smoke): taps → lights, mouse hold → charged attacks on sword,
  greatsword, crossbow; dash; real combat room hits; perfect dodge (slow-mo + counter set), melee parry (riposte + 1.2 s stun),
  projectile reflect (`from: 'player'`) — zero console errors. Full smoke not run (per brief).

## Risks / notes for the integration pass
1. **Hold no longer auto-repeats light attacks.** Holding attack = one light, then charge, auto-release at full, repeat. Mashing = chain.
   This also applies to Nỏ/Gậy Phép (holding fires charged shots instead of auto-fire). Smoke `fight()` clicks (140–160 ms taps) so
   it still produces one light per click; `tools/perf.mjs` holds attack for 120 s and will now see charged attacks every ~1.5 s
   (fewer `attack` events, different load profile).
2. Greatsword taps faster than its 620 ms chain window are dropped after the 120 ms buffer (intended commitment). Bots that
   spam clicks with greatsword deal less damage per click than v1.
3. Global slow-mo scales the scene `dt` only; tweens/sprite anims and `time.delayedCall` run at normal speed for those 350 ms.
4. Non-breaking hits push enemies at ~45% of v1 knockback (by design); if the enemy-AI workstream tunes contact pressure, revisit
   `knockImpulse` multipliers (0.45 / 1.3) in `combat.ts`.
5. `hitEnemy`'s spark now comes from `CFX.impact` (rotated `fx_hit`/`fx_crit` image + tween) instead of `fxAt`; if the perf
   workstream pools fx (`src/game/fxPool.ts`), `combatFx.ts` `spark()` is the one place to switch over.
6. Poise state is a `WeakMap` keyed by the enemy object in `combatFx.ts` (no change to the shared `Enemy` interface).
