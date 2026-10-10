# Tháp Sao — combat frame data (v2)

Source of truth: `src/systems/combat.ts` (`LIGHT`, `CHARGED`, constants). Rules are unit-tested in `tests/combat.test.ts`.
All times are **milliseconds at 100% attack speed**; at runtime every time is multiplied by
`scale = (weapon interval / def interval) / attackRate` (Anvil attack-speed upgrades, AttackSpeed stat, Dagger Fury ×1.5).
Columns "Next light at", "Dash-cancel at" and "Recovery" are measured **from the button press** (startup included).

## Light chains (tap the attack button)
- The hitbox lands at *Startup*. A press made before *Next light at* is buffered for 120 ms and fires as soon as the window opens.
- *Dash-cancel at*: earliest dash. A dash pressed earlier is buffered 120 ms and fires the moment the window opens (coyote cancel).
- *Recovery*: end of the move; until then movement is multiplied by *Move×* (×0.5 of it during startup).
- *Feint* = yes: the startup can be dash-cancelled and the swing follows your aim until it lands. Greatsword (no): angle locked at the press,
  no dash during startup, but super armor — getting hit does not interrupt it (all other weapons lose the strike if hit during startup).
- Range/Arc are the weapon's base values × the hit's multipliers. The last hit of a chain is the finisher (kết): bigger arc/reach,
  lunge, ×knock, high poise damage, stronger hit-stop and shake. Anvil `extraHit` repeats the non-finisher hits; the last is always the finisher.
- Swings alternate direction (sweep ±1) — the slash art flips.

| Weapon | Hit | Coef | Startup | Next light at | Dash-cancel at | Recovery | Range px | Arc° | Lunge px | Knock× | Poise | Feint | Move× |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Kiếm & Khiên | 1 | 1 | 50 | 270 | 130 | 370 | 58 | 100 | 10 | 0.8 | 10 | yes | 0.6 |
| Kiếm & Khiên | 2 | 1 | 50 | 270 | 130 | 370 | 58 | 90 | 10 | 0.8 | 10 | yes | 0.6 |
| Kiếm & Khiên | 3 (kết) | 1.4 | 100 | 520 | 280 | 620 | 67 | 130 | 22 | 2.2 | 25 | yes | 0.6 |
| Đại Kiếm | 1 | 1.8 | 180 | 620 | 520 | 800 | 78 | 160 | 14 | 1 | 30 | no | 0.2 |
| Đại Kiếm | 2 (kết) | 2.4 | 240 | 860 | 720 | 1090 | 87 | 176 | 24 | 1.7 | 50 | no | 0.15 |
| Dao Găm | 1 | 0.6 | 0 | 140 | 0 | 180 | 44 | 80 | 6 | 0.3 | 4 | yes | 0.9 |
| Dao Găm | 2 | 0.6 | 0 | 140 | 0 | 180 | 44 | 80 | 6 | 0.3 | 4 | yes | 0.9 |
| Dao Găm | 3 | 0.7 | 0 | 140 | 0 | 180 | 44 | 64 | 8 | 0.3 | 4 | yes | 0.9 |
| Dao Găm | 4 (kết) | 1 | 30 | 290 | 90 | 330 | 51 | 96 | 28 | 1.4 | 14 | yes | 0.7 |
| Kiếm Cong | 1 | 1 | 60 | 280 | 160 | 360 | 66 | 110 | 10 | 0.7 | 12 | yes | 0.6 |
| Kiếm Cong | 2 | 1.1 | 60 | 300 | 160 | 380 | 66 | 110 | 10 | 0.7 | 12 | yes | 0.6 |
| Kiếm Cong | 3 (kết) | 1.6 | 100 | 440 | 240 | 560 | 83 | 50 | 50 | 1.8 | 28 | yes | 0.6 |

Ranged weapons (Nỏ, Gậy Phép) keep the v1 cadence (cooldown = interval, ×1.6 on the single-hit chain) and magazine/reload rules;
their move data only adds a short move slow (Nỏ ×0.8 for 120 ms, Gậy ×0.75 for 160 ms) and always allows dash.

## Charged attack (hold the attack button — touch: hold "Đánh")
Hold ≥ **280 ms** → charging starts (ring above Bông fills). Release at ≥ **35%** charge → charged attack; coefficient = Coef × (0.6 + 0.4 × charge).
Release below 35% = cancelled. At full charge ("Tụ đầy!") holding **350 ms** more auto-releases at full power, so a held touch button
never gets stuck and keeps attacking. Charging is impossible while guarding, reloading or with an empty magazine; the crossbow
charged bolt spends one bolt. Dash cancels the charge. Anvil `chargeSpeedPct` shortens the charge time.

| Weapon | Charge time | Coef (full) | Startup | Recovery | Range px | Arc° | Lunge | Knock× | Poise | Extra | Move× while charging |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Kiếm & Khiên | 500 | 2.2 | 60 | 450 | 70 | 180 | 30 | 2.6 | 40 | — | 0.55 |
| Đại Kiếm | 800 | 3.4 | 120 | 700 | 101 | 224 | 0 | 2.2 | 80 | — | 0.3 |
| Dao Găm | 350 | 2 | 20 | 250 | 75 | 32 | 60 | 1.2 | 20 | +25% crit | 0.75 |
| Kiếm Cong | 550 | 2.5 | 50 | 400 | 89 | 176 | 20 | 1.6 | 35 | — | 0.55 |
| Nỏ | 450 | 2.6 | 0 | 300 | — | — | 0 | 1.5 | 25 | pierce +3, speed ×1.4, size ×1.5 | 0.6 |
| Gậy Phép | 600 | 2.4 | 0 | 350 | — | — | 0 | 1.2 | 25 | pierce +2, speed ×0.85, size ×1.8 | 0.5 |

## Dash, perfect dodge
| Value | Number |
|---|---|
| Dash | 180 ms, 140 px (unchanged) |
| Dash i-frames | 230 ms from dash start (dash + 50 ms tail); hero tinted cyan for exactly that window |
| Perfect dodge | a *threat* (enemy projectile, hazard/explosion, charging enemy, exploder, any boss hit) reaches you ≤ **120 ms** after dash start |
| Reward | slow-mo ×0.3 for 350 ms (real time) + next hit **+50% damage** within 1.5 s; cooldown 1 s |
| Plain contact with a walking enemy | never counts (no dash-through farming) |

## Guard / perfect parry (Kiếm & Khiên, "Đỡ" button / RMB / K)
| Value | Number |
|---|---|
| Perfect window | first 150 ms after raising the guard (unchanged `PERFECT_GUARD`) |
| Spam lockout | raising the guard again < 350 ms after dropping it gives **no** perfect window (unless the last guard parried) |
| Parry vs melee/contact | attacker stunned 1.2 s, poise reset, shoved away (320 px/s ÷ weight); hit-stop 90 ms, heavy shake |
| Parry vs projectile | projectile is **reflected** at the nearest enemy, ×1.2 speed, ×1.5 damage |
| Riposte | after any perfect parry the next hit within 1.2 s is a guaranteed crit |
| Guard during a wind-up | drops the pending strike (guard-cancel) |

## Poise, weight, knockback
- Weight = clamp(radius / 16, 0.7, 2.5) × 1.6 if elite. Poise = 12 + 0.8 × radius (+30 elite); refills 1.2 s after the last poise damage.
- Each melee hit deals its *Poise* value; other knocking hits deal 6 × knockMul. Breaking poise = **stagger** (stun 450 ms, "Choáng!").
- Knockback impulse = weapon knockback × move knock × knockMul ÷ weight × (0.45 while poise holds, 1.3 on the breaking hit).
  Result: enemies hold their ground on light hits and get launched by finishers / greatsword / charged attacks.
- Bosses and training dummies: no knockback, no stagger (boss patterns stay intact). Turrets: stagger yes, knockback no.

## Hit-stop and screen shake
- Hit-stop (s) = melee 0.035 × move hitstop + min(0.03, 0.08 × damage / target max HP) (+0.025 crit, +0.02 charged melee,
  +0.015 poise break, +0.015 kill); ranged/procs only on crits (0.02) or charged shots (0.05). Cap 0.12 s. Several targets → max, not sum.
- Shake tiers: 1 = 60 ms/0.002 (crits, dagger finisher), 2 = 100 ms/0.004 (finishers, poise breaks, charged), 3 = 160 ms/0.007
  (greatsword finisher & charged, perfect parry), 4 = 260 ms/0.01 (reserved). Player-hurt / boss shakes unchanged.
- Hit sparks: `fx_hit` / `fx_crit` at the contact edge, rotated along the hit direction; finishers/charged add an `fx_slash_small` cross.
