import type { ChapterDef } from './types';

const chapters: ChapterDef[] = [
  { id: 1, name: 'Rừng Rêu', tileset: 'ts_ch1', tint: 0x98b466,
    enemies: ['slime_moss', 'mushroom_spore', 'beetle_charger', 'sprout_archer', 'bee_swarm'], miniBoss: 'mb_thorn_boar', boss: 'boss_mushroom_king' },
  { id: 2, name: 'Mỏ Đá Đỏ', tileset: 'ts_ch2', tint: 0xcf7a4f,
    enemies: ['rat_bandit', 'rat_bomber', 'rat_shield', 'mole_digger', 'rat_crossbow'], miniBoss: 'mb_rat_captain', boss: 'boss_rat_chief' },
  { id: 3, name: 'Thư Viện Bay', tileset: 'ts_ch3', tint: 0x8e6cd8,
    enemies: ['book_flyer', 'ink_blob', 'candle_mage', 'mirror_construct', 'quill_turret'], miniBoss: 'mb_ink_golem', boss: 'boss_owl_librarian' },
  { id: 4, name: 'Hồ Băng', tileset: 'ts_ch4', tint: 0x9fd8ec,
    enemies: ['penguin_slider', 'ice_spirit', 'seal_lobber', 'frost_wolf', 'snow_golem_small'], miniBoss: 'mb_yeti', boss: 'boss_ice_walrus' },
  { id: 5, name: 'Xưởng Máy Hơi', tileset: 'ts_ch5', tint: 0xb08a5a,
    enemies: ['gear_bot', 'steam_turret', 'raccoon_mechanic', 'drone_bomber', 'piston_brute'], miniBoss: 'mb_saw_crab', boss: 'boss_raccoon_golem' },
  { id: 6, name: 'Lõi Sao', tileset: 'ts_ch6', tint: 0x4a3a7a,
    enemies: ['star_shard', 'void_eye', 'comet_hound', 'nebula_healer', 'star_knight'], miniBoss: 'mb_dark_twin', boss: 'boss_fallen_star' },
];
export default chapters;
