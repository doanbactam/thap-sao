// Ticks docs/CHECKLIST.md from evidence: vitest JSON results (out/vitest.json) + smoke report (out/smoke/report.json).
// Each line is ticked only if every proof listed for it passed. Proof syntax: "t:<substring of test full name>" or "s:<smoke check id>".
import fs from 'node:fs'; import path from 'node:path'; import { execSync } from 'node:child_process'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
if (!process.argv.includes('--no-test')) execSync('npx vitest run --reporter=json --outputFile=out/vitest.json', { cwd: root, stdio: 'ignore' });
const vt = JSON.parse(fs.readFileSync(path.join(root, 'out/vitest.json'), 'utf8'));
const tests = vt.testResults.flatMap((f) => f.assertionResults.map((a) => ({ name: `${a.ancestorTitles.join(' > ')} > ${a.title}`, ok: a.status === 'passed' })));
const smoke = fs.existsSync(path.join(root, 'out/smoke/report.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'out/smoke/report.json'), 'utf8')) : { checks: {}, errors: ['no smoke report'] };
const P = {
  C001: ['t:base values match spec'], C002: ['t:mp regen 4/s'], C003: ['t:move speed 150'], C004: ['t:defense capped', 't:target defense reduces'], C005: ['t:incoming: evasion'],
  C006: ['t:base * coef', 't:percent bonus', 't:crit multiplier'], C007: ['t:luck raises higher tiers'], C008: ['t:barter buy/sell'], C009: ['t:lifesteal'], C010: ['t:spells scale with magic only'],
  C011: ['t:xp levels', 't:level mods +5 hp', 't:xp level up gives full MP'], C012: ['t:burn stacks'], C013: ['t:frostbite freezes'], C014: ['t:shock +15%'], C015: ['t:poison dot'], C016: ['t:wound adds bleed'], C017: ['t:stun disables'],
  C018: ['t:dash recharge', 's:C018_dash'], C019: ['t:dash recharge'], C020: ['t:guard frontal'], C021: ['t:guard frontal'], C022: ['s:C022_real_combat'],
  C023: ['t:sword&shield 3-hit'], C024: ['t:greatsword 2-hit'], C025: ['t:dagger 4-hit'], C026: ['t:katana 3rd hit'], C027: ['t:crossbow magazine'], C028: ['t:staff uses magic'], C029: ['t:every weapon has a dash attack'],
  C030: ['t:weapons need destiny unlock', 's:C030_weapon_training_unlock'], C031: ['t:>= 8 upgrades per weapon'], C032: ['t:upgrade mods are applied'], C033: ['t:element aspect converts'], C034: ['t:anvil: tier gated', 's:C034_anvil'],
  C035: ['t:starts 5x4'], C036: ['t:side bag: 4 cells'], C037: ['t:places without overlap', 's:C037_place_drag'], C038: ['t:rotation gives 4 orientations', 't:rotated L fits'], C039: ['t:artifact level starts 0'],
  C040: ['t:touchEdge'], C041: ['t:emptyNeighbor'], C042: ['t:cornerOnly'], C043: ['t:noOtherOfTag'], C044: ['t:conditional variants'], C045: ['t:+2 tablet', 's:C045_tablet_level_live'], C046: ['t:-1 level disables'],
  C047: ['t:ignoreConstraint tablet'], C048: ['t:maxLevel op raises cap'], C049: ['t:doubleTags doubles'], C050: ['t:copy op copies'], C051: ['t:tablet rotation rotates targets'], C052: ['t:tablets do not affect tablets'],
  C053: ['t:reports invalid cells', 's:C053_live_recompute'], C054: ['t:thresholds count ACTIVE'], C055: ['s:C055_combo_panel'], C056: ['s:C056_sell_zone'], C057: ['t:spells: up to 2 quick slots', 's:C057_spell_slot'],
  C058: ['t:potions: heal 40%', 't:rage / iron / swift / mana', 's:C058_potion_drink'], C059: ['t:miracle stat effect', 's:C075_roots'], C060: ['t:content minimums in registry'],
  C061: ['t:stat flat/pct'], C062: ['t:onHit chance'], C063: ['t:onKill actions'], C064: ['t:onDash actions'], C065: ['t:onHurt actions'], C066: ['t:periodic fires'], C067: ['t:conditional variants', 't:conditional wrapping'],
  C068: ['t:spells: up to 2', 't:summons and specials'], C069: ['t:every special id used by content is implemented', 't:freezeShatter'],
  C070: ['t:6 chapters x 3 floors', 's:C110_full_run'], C071: ['s:C071_start_room_f1', 's:C071_start_shop_dummy_f2', 't:start shop from global floor 2'], C072: ['t:3 columns x 3 deep', 't:links only to adjacent', 't:branching occurs', 's:C072_enter_node'],
  C073: ['s:C071_start_room_f1', 't:choices: start'], C074: ['t:all 10 node types appear', 's:C074_all_nodes'], C075: ['t:miracle choice from roots', 's:C075_roots'], C076: ['t:enchant altar sizes', 't:enchant raises level', 's:C076_enchant'],
  C077: ['s:C077_derangement', 's:C077_miniboss_drop', 't:waves 1-3'], C078: ['s:C078_room_cleared_doors_open', 't:node entry follows map links'], C079: ['t:modifiers and events distribution', 't:all 9 events resolve', 's:C079_all_events'],
  C080: ['t:choice 1/3 unique', 's:C080_reroll_choice', 's:C080_reroll_shop'], C081: ['t:death rewards sapphires', 's:C081_death_results'], C082: ['t:6 chapters x 3 floors', 's:C082_ending', 's:C082_hard_mode_unlocked', 't:hard mode +40%'],
  C083: ['t:run roundtrip', 's:C083_save_continue'], C084: ['t:content minimums in registry'], C085: ['t:chaser approaches', 't:healer heals', 't:turret stays'], C086: ['t:charger telegraphs', 't:lobber marks', 't:exploder fuses'],
  C087: ['t:phases at thresholds', 's:C087_phases', ...[1, 2, 3, 4, 5, 6].map((c) => `s:C087_boss_ch${c}_damaged`)], C088: ['t:every pattern used by content', 't:slam, minefield'], C089: ['s:C089_boss_bar'], C090: [1, 2, 3, 4, 5, 6].flatMap((c) => [`s:C090_chapter_theme_${c}`, `s:C090_combat_room_${c}`]),
  C091: ['s:C091_hub'], C092: ['t:destiny tree has >= 30', 't:requirements and costs', 's:C092_destiny_buy'], C093: ['t:grant keys present', 't:unlockArtifacts adds', 't:levelUpHeal', 't:chestReroll'],
  C094: ['t:talent points cap 25', 's:C094_talents_respec'], C095: ['t:>= 6 costumes'], C096: ['s:C096_weapon_rack'], C097: ['t:journal discovery', 's:C097_journal'], C098: ['s:C098_training_spawn'], C099: ['t:migration from v1', 't:meta roundtrip', 's:C099_meta_persisted'],
  C100: ['s:C100_hud'], C101: ['s:C101_inventory_opens', 's:C101_pauses_combat', 's:inventory_full'], C102: ['s:C102_choice_cards'], C103: ['t:every engine key resolves', 't:every literal t(', 't:ev.*, node.*, rar.*', 's:C103_font_vn'], C104: ['s:C104_touch_joystick', 's:C104_touch_attack_button'],
  C105: ['s:C105_keyboard_mouse'], C106: ['s:C106_landscape_fit'], C107: ['s:C107_manifests', 's:single_file_build'], C108: ['s:C108_sfx'], C109: ['s:C109_mute'], C110: ['s:C110_full_run', 's:C081_death_results', 's:C092_destiny_buy', 's:__noerrors'],
  // V2 depth (integration pass)
  C111: ['t:windups never drop below MIN_WINDUP', 't:contact damage only during active melee frames', 's:V2_enemy_telegraph'],
  C112: ['t:normal rooms have 2–3 waves, arena 3–4', 't:escalates: budget grows', 's:V2_wave_waves', 's:C079_event_arena'],
  C113: ['t:elites: none on chapter 1 floor 1', 's:V2_elite_marker'],
  C114: ['t:hold → charge after HOLD_DELAY', 't:every weapon has a light chain and a charged attack', 's:V2_charged_attack'],
  C115: ['t:a threat within the window = perfect dodge', 's:V2_perfect_dodge'],
  C116: ['t:a successful parry lifts the lockout', 's:V2_parry', 's:V2_projectile_reflect'],
  C117: ['t:tablet: target cells with sign, level change and disabling', 't:moving an item compares against the pre-drag snapshot', 's:V2_drag_preview'],
  C118: ['t:every choice card has a concrete numeric delta', 't:lock keeps an option through a reroll', 's:V2_choice_deltas', 's:V2_choice_keep', 's:V2_choice_banish'],
  C119: ['t:skills: every spell and weapon special has tuning, cooldown and a distinct sfx', 't:balance band', 's:V2_skill_spell_cast', 's:V2_skill_weapon_special'],
  C120: ['t:cast buffer', 't:wind-up: effect fires', 't:touch drag', 's:V2_skill_touch_drag_cancel'],
  C121: ['t:synergy: tooltip numbers follow', 't:ready pulse fires once', 's:V2_skill_cooldown_sweep', 's:V2_skill_mp_deny'],
};
const proofOk = (p) => {
  if (p === 's:__noerrors') return (smoke.errors ?? []).filter((e) => !e.startsWith('check failed')).length === 0;
  if (p.startsWith('t:')) { const m = tests.filter((x) => x.name.includes(p.slice(2))); return m.length > 0 && m.every((x) => x.ok); }
  return smoke.checks?.[p.slice(2)] === true;
};
const file = path.join(root, 'docs/CHECKLIST.md'); let md = fs.readFileSync(file, 'utf8'); let ticked = 0, total = 0; const missing = [];
md = md.split('\n').map((line) => {
  const m = line.match(/^- \[[ x]\] (C\d{3}) (.*?)( — proof: .*)?$/); if (!m) return line;
  total++; const proofs = P[m[1]] ?? []; const ok = proofs.length > 0 && proofs.every(proofOk); if (ok) ticked++; else missing.push(`${m[1]}: ${proofs.filter((p) => !proofOk(p)).join(', ') || 'no proof mapped'}`);
  return `- [${ok ? 'x' : ' '}] ${m[1]} ${m[2]} — proof: ${proofs.map((p) => (p.startsWith('t:') ? `test "${p.slice(2)}"` : `smoke ${p.slice(2)}`)).join('; ')}`;
}).join('\n');
fs.writeFileSync(file, md);
console.log(`CHECKLIST: ${ticked}/${total} ticked`); if (missing.length) console.log('unproven:\n' + missing.join('\n'));
process.exit(ticked === total ? 0 : 1);
