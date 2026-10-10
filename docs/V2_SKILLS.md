# V2 — Active skills polish (spells + weapon specials)

Scope: improve and polish the existing active skills — the 6 quick-slot spells (keys **1 / 2**, artifacts in `src/data/artifacts.ts`)
and the 6 weapon specials (**F / L**, touch "Kỹ năng"). No new spells, weapons or items.

Code: `src/systems/skills.ts` (pure rules + tuning, unit-tested in `tests/skills.test.ts`), `src/systems/skillFx.ts` (scene glue:
input, buffer, wind-up, cancel, VFX, aim preview, touch overlay), `src/scenes/HudScene.ts` (`drawSkills`), `src/game/input.ts`
(hold / release / cancel edges, touch skill buttons), `src/game/audio.ts` (12 skill voices + `cast` / `ready` / `cancel`).

## Audit (before)
| Problem found | Fix |
|---|---|
| Arcane Missiles: 5 missiles × (power + **full** Magic) for 10 MP — best value per MP by ~2× and scaled 5× with Magic | each missile uses 40 % of Magic; 14 MP, cd 1.5 s |
| Spell books were weaker than weapon specials (V2_BUILD) for fire/ice/chain; specials had **no cooldown**, only MP | specials got short cooldowns + lower MP; spells got cheaper/faster where their role needed it |
| HUD cooldown overlay used the **base** cooldown while the real one was reduced by Cooldown% → bar started part-empty | sweep uses the reduced cooldown (`cdMax`) |
| Spell crit was a fixed ×1.5 (ignored Crit Damage) | spell crits use `critMultiplier(critDamage)` like weapon hits, shown gold |
| Dagger Shadow Step spent MP with no target in range | needs a target (picked along the aim), else "Không có mục tiêu" deny, nothing spent |
| Casting was instant, no wind-up / buffer / cancel rules; spells could fire mid-attack | 120 ms buffer, wind-up, cancel like `combat.ts` (below) |
| Iaido perfect window was invisible | glint + ping when the window opens, preview line turns gold inside it |
| Staff nova / iaido line / chain zaps created a Graphics + tween per cast | one pooled Graphics for all rings / lines / bolts (`skillFx` VFX list, cap 48) |
| All skills used `sfx('magic')` | a distinct voice per skill |

## Tuning table (after)
Fresh hero: Physical 20, Fire 20, Magic 10, crit 0, artifacts at level 1. Value/MP = damage × expected targets / MP.

### Spells (cost / cooldown / power on the artifact; feel in `SPELL`)
| Spell | Role | MP before → after | CD before → after | Other changes | Wind-up | Value/MP |
|---|---|---|---|---|---|---|
| Băng Tiễn (icebolt) | cheap, fast single target, applies Frostbite | 12 → 12 | 1.5 → **1.2 s** | speed 520 → 620 | 100 ms | 4.2 |
| Cầu Lửa (fireball) | AoE into groups, Burn | 15 → **16** | 2 | explosion 70 → **90 px** | 160 ms | ~8 (2 targets) |
| Sét Nhảy (chain) | auto-target, bounces through spread-out crowds, Shock | 18 → **16** | 2.5 | bounce damage 70 → **80 %** | 120 ms | ~8 (3 targets) |
| Tia Bí Thuật (arcane) | homing sustained single-target, for evasive enemies | 10 → **14** | 1.2 → **1.5 s** | Magic share 100 → **40 %** per missile | 140 ms | 5.7 (was 11) |
| Bong Bóng (shield) | defensive: absorb before a big hit | 20 → **18** | 8 → **7 s** | duration 4 → **5 s**, bubble ring visible while it holds | 80 ms | — |
| Dịch Chuyển (blink) | mobility through enemies, i-frames | 10 → **8** | 3 → **2.5 s** | counts as a dash for Perfect Dodge | 50 ms | — |

### Weapon specials (MP = `specialMp` × Anvil `specialCostPct`; feel in `SPECIAL`)
| Weapon · special | Role | MP before → after | CD before → after | Damage before → after | Feel |
|---|---|---|---|---|---|
| Kiếm & Khiên · Lao Khiên | gap-close + control (i-frames while bashing) | 20 → **16** | 0 → **2 s** | coef 1.5 → **1.8**, dash 160 → 170 px, stun 1 → **1.2 s** | 80 ms wind-up, hit-stop 70 ms, shake 2 |
| Đại Kiếm · Xoáy Kiếm (hold) | crowd clear | 25 → **22** | 0 → **3 s** | 0.7 × hit-1 per 0.2 s; min spin 0.6 → **0.75** × duration (tap is worth it) | super armor still applies |
| Dao Găm · Bước Bóng | single-target burst | 15 → **14** | 0 → **1.5 s** | finisher × backstab ×2, forced crit (unchanged); target picked along the aim | 50 ms, hit-stop 80 ms |
| Kiếm Cong · Bạt Đao (hold) | timing skill | 20 → **18** | 0 → **1.2 s** (perfect = **refund**) | coef 2.2 → **2.4** × power, dash 220 → 230 px | perfect: glint, gold line, hit-stop 110 ms, shake 3 |
| Nỏ · Tên Xuyên Phá | line sniping, pierces all, no ammo | 20 → **18** | 0 → **1 s** | coef 3.0 → **4.2**, speed 760 → 900 | 120 ms wind-up |
| Gậy Phép · Bộc Phá | panic button around the hero | 30 → **24** | 0 → **2.5 s** | coef 2.5 → **3.0**, knockback ×1.8, **200 ms i-frames** | 180 ms wind-up |

All specials now sit above the same weapon's charged attack per use (e.g. crossbow charged 2.6 vs special 4.2, katana charged 2.5 vs
perfect iaido 2.4 × 1.2 crit) and the MP budget (`power.ts`) caps special uses by its cooldown. `tests/skills.test.ts` "balance band"
keeps every damaging spell/special at 3–10 damage per MP and arcane ≤ fireball.

## Feel rules (consistent with `combat.ts`)
- **Hold = aim, release = cast.** While a skill key / touch button is held the floor shows its shape: line (+ blast circle for fireball),
  circle (nova, spin), cone (arcane), target ring on the auto-target (chain, dagger), blink path + landing ring, self ring (bubble).
  Grey = on cooldown / not enough MP; red = will cancel. A quick tap casts immediately on release.
- **Aim**: touch drag > mouse > nearest enemy in the skill's reach > facing.
- **Buffer**: a release is buffered 120 ms (`BUFFER`) and fires when the cast window opens. Cast window = combat's dash-cancel rule
  (idle, a feint-able startup, recovery past `dashCancel`), never while dashing, guarding, charging, spinning or already casting.
- **Wind-up**: per skill (0–180 ms) with the rig pose (`playAttack('cast'|'bash'|'shoot'|'stab', … windupMs)`), a progress ring on the hero,
  move speed ×0.5, attacks blocked. MP + cooldown are committed **at the end** of the wind-up.
- **Cancel**: dash, guard, or getting hit (unless super armor) during the wind-up cancels it — nothing spent. Right-click while holding,
  or dragging a touch skill button past the 110 px ring, cancels the held skill. Charge specials cancel the same way.
- **Impact**: per-skill hit-stop + shake tier (first hit only for projectiles), pooled sparks/fx (`fxPool`), distinct SFX.

## HUD
Three slots after the potion belt: Spell 1, Spell 2, Weapon special (weapon icon). Each has a clockwise **radial cooldown sweep** clipped to
the slot, remaining seconds, MP cost (red when short), key label (1 / 2 / F; hidden on touch), blue dim when MP is short, **red flash + deny
sfx** on a refused press (the MP bar flashes too when the reason is MP), a **white ready pulse + ping** when the cooldown ends, gold frame
while held. **Tooltip** on hover, a 450 ms touch long-press or a 900 ms key hold: name, MP · cooldown (after Cooldown%), damage per hit (after Magic,
Damage%, artifact level), crit chance (incl. Spell Crit), extras, Spell Echo chance, role. Touch skill buttons (Kỹ năng + Phép 1 / Phép 2) carry
the same sweep / MP dim / deny / pulse overlay and the cancel ring while held.

## Synergy check
| Source | Applies to | Shown |
|---|---|---|
| Cooldown% (`cooldownPct` stat: academy combo ★4/★6, spell-echo tome, periodic-orb artifact) | spells **and now weapon specials** (cap 60 %) | tooltip cooldown + sweep length |
| Magic (talents, scholar items, combos, miracles) | spell damage (arcane 40 %), staff special via magic share | tooltip damage |
| Damage% + Anvil `damagePct` | spells / specials | tooltip damage |
| `spellCrit`, Crit Damage | spell crit chance / multiplier | tooltip crit % |
| `spellEcho` | re-casts 250 ms later ("Lặp lại!") | tooltip "Lặp lại N%" |
| Anvil `specialCostPct`, `novaRadiusPct`, `spinDuration`, `iaidoWindow`, `backstabMult` | specials | tooltip MP; nova preview radius |
| artifact level (tablets ★) | spell power | tooltip damage / shield / blink distance |
| MP max / regen / onKill MP, `manaShield` | MP budget | MP bar + low-MP dim |

## Verification
`tests/skills.test.ts` (20 tests); smoke checks `V2_skill_spell_cast`, `V2_skill_cooldown_sweep`, `V2_skill_weapon_special`,
`V2_skill_mp_deny`, `V2_skill_touch_drag_cancel`; screenshot `out/smoke/*_v2_skills.png` (special line preview held + spell sweeps).
Checklist C119–C121. Debug handle: `window.__TSSkills.state()` (slots, cooldowns, preview); `Hud.skillView` for the HUD.

## Risks
- Release-to-cast adds the hold time to keyboard casts (a tap ≈ instant); players used to press-to-cast may notice.
- Specials now have cooldowns — Fury dagger players can no longer chain Shadow Step on MP alone (1.5 s gate).
- Two skills released together: the second is dropped if the first's wind-up exceeds the 120 ms buffer (same rule as attacks).
- Balance was checked with value-per-MP math and the power heuristic, not a human playtest; `npm run sim` was not re-run.
