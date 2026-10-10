// Hub-side scenes: Destiny tree, Talents, Costumes, Weapon rack, Journal, Settings, artifact picker (training),
// Results (death) and Ending/Credits.
import Phaser from 'phaser';
import { Overlay } from './Overlay';
import { G } from '../game/state';
import { PAL, RARITY_COLOR, iconRef, tex, applyEntry, playAnim, bakeTiles, face } from '../game/assets';
import { sfx, setMute } from '../game/audio';
import { txt, darkTxt, card, button, wrapText, toast, pill, title, stars } from '../ui/kit';
import { t } from '../systems/i18n';
import { destiny, talents, costumes, weapons, artifacts, tablets, enemies, bosses, miracles, getDestiny, getArtifact, getCostume } from '../systems/registry';
import { canBuyDestiny, buyDestiny, spendTalent, respecTalents, talentPointsTotal, talentPointsSpent, hasHomeRepairs, checkCostumeUnlocks, costumeProgress, weaponDestinyUnlocked, weaponUsable, artifactPool, canUseHardMode } from '../systems/meta';
import { addItem } from '../systems/inventory';
import { newRun } from '../systems/run';
import type { WeaponId } from '../data/types';
import { itemDesc } from '../ui/gridView';

export class DestinyScene extends Overlay {
  constructor() { super('Destiny'); }
  info!: Phaser.GameObjects.Container;
  create() { this.build(); }
  build() {
    this.children.removeAll(true); this.frame(t('destiny.title'));
    pill(this, 80, 92, 140, 'ic_sapphire', G.meta.sapphires);
    const g = this.add.graphics(); const P = (n: typeof destiny[0]) => ({ x: 640 + n.pos[0] * 104, y: 640 - n.pos[1] * 64 });
    for (const n of destiny) for (const r of n.requires) { const m = getDestiny(r); if (!m) continue; const a = P(n), b = P(m); g.lineStyle(4, G.meta.destinyOwned.includes(n.id) ? PAL.green : PAL.woodLo, 1).lineBetween(a.x, a.y, b.x, b.y); }
    for (const n of destiny) {
      const p = P(n); const owned = G.meta.destinyOwned.includes(n.id); const can = canBuyDestiny(G.meta, n.id);
      const col = owned ? PAL.green : can.ok ? PAL.orange : can.reason === 'cost' ? PAL.wood : 0x8a7a6a;
      const c = this.add.container(p.x, p.y); const gg = this.add.graphics(); gg.fillStyle(col, 1).fillCircle(0, 0, 24).lineStyle(3, PAL.outline, 1).strokeCircle(0, 0, 24); c.add(gg);
      c.add(txt(this, 0, -1, owned ? '✓' : String(n.cost), 15).setOrigin(0.5));
      c.setSize(48, 48).setInteractive({ useHandCursor: true });
      c.on('pointerover', () => this.showInfo(n.id)); c.on('pointerup', () => { this.showInfo(n.id); this.tryBuy(n.id); });
      (c as any).btnId = `destiny_${n.id}`;
    }
    this.info = this.add.container(0, 0);
  }
  tryBuy(id: string) {
    if (buyDestiny(G.meta, id)) { sfx('levelup'); G.logEvent('destinyBuy', { id }); G.saveMeta(); toast(this, `${t('destiny.owned')}: ${getDestiny(id)!.name}`, '#a6e070'); this.build(); this.showInfo(id); }
    else sfx('deny');
  }
  showInfo(id: string) {
    this.info.removeAll(true); const n = getDestiny(id)!; const owned = G.meta.destinyOwned.includes(id); const can = canBuyDestiny(G.meta, id);
    this.info.add(darkTxt(this, 70, 140, n.name, 22, { fontStyle: '800' }));
    this.info.add(wrapText(this, 70, 172, `${n.desc}\n${t('cur.sapphire')}: ${n.cost}\n${owned ? t('destiny.owned') : can.ok ? 'Nhấn để khắc' : can.reason === 'cost' ? 'Chưa đủ Ngọc Sao' : t('destiny.locked')}`, 260, 15));
  }
}

export class TalentsScene extends Overlay {
  constructor() { super('Talents'); }
  create() { this.build(); }
  build() {
    this.children.removeAll(true); this.frame(t('talent.title'));
    const total = talentPointsTotal(G.meta), spent = talentPointsSpent(G.meta);
    darkTxt(this, 80, 100, `${t('talent.points')}: ${total - spent}/${total}`, 22, { fontStyle: '800' });
    if (!hasHomeRepairs(G.meta)) darkTxt(this, 80, 130, t('talent.needRepair'), 17, { color: '#A9531E' });
    talents.forEach((tl, i) => {
      const x = 90 + (i % 3) * 370, y = 170 + Math.floor(i / 3) * 110; const r = G.meta.talentRanks[tl.id] ?? 0;
      const g = this.add.graphics(); g.fillStyle(PAL.creamLo, 1).fillRoundedRect(x, y, 350, 96, 12).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x, y, 350, 96, 12);
      const ir = iconRef(this, `st_${tl.stat}`); this.add.image(x + 36, y + 48, ir.tex, ir.frame).setDisplaySize(48, 48);
      darkTxt(this, x + 70, y + 8, tl.name, 19, { fontStyle: '800' }); wrapText(this, x + 70, y + 34, `${tl.desc} (+${tl.perRank}/bậc)`, 190, 13);
      stars(this, x + 76, y + 80, r, tl.maxRank, 11);
      button(this, x + 300, y + 48, 70, 50, '+', () => { if (spendTalent(G.meta, tl.id)) { sfx('ui'); G.saveMeta(); G.logEvent('talent', { id: tl.id }); this.build(); } else sfx('deny'); }, 'green', { id: `talent_${tl.id}` });
    });
    button(this, 640, 660, 300, 54, t('talent.respec'), () => { respecTalents(G.meta); G.saveMeta(); G.logEvent('respec', {}); this.build(); }, 'purple', { id: 'respec' });
  }
}

export class CostumesScene extends Overlay {
  constructor() { super('Costumes'); }
  create() { checkCostumeUnlocks(G.meta); G.saveMeta(); this.build(); }
  build() {
    this.children.removeAll(true); this.frame(t('costume.title'));
    costumes.forEach((c, i) => {
      const x = 230 + (i % 3) * 410, y = 250 + Math.floor(i / 3) * 250; const un = G.meta.unlockedCostumes.includes(c.id); const worn = G.meta.costume === c.id;
      const g = this.add.graphics(); g.fillStyle(worn ? 0xe8f5d0 : PAL.creamLo, 1).fillRoundedRect(x - 190, y - 110, 380, 230, 14).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 190, y - 110, 380, 230, 14);
      tex(this, c.sprite, 'char'); const sp = this.add.sprite(x - 120, y + 30, c.sprite); applyEntry(sp, c.sprite, 90, [0.5, 0.9]); playAnim(sp, c.sprite, 'idle'); if (!un) sp.setTint(0x333333);
      darkTxt(this, x - 50, y - 96, c.name, 22, { fontStyle: '800' });
      const st = Object.entries(c.stats ?? {}).map(([k, v]) => `${k} ${(v as number) > 0 ? '+' : ''}${v}`).join(', ');
      wrapText(this, x - 50, y - 62, `${c.desc}${c.fixedHp ? `\nMáu cố định ${c.fixedHp}` : ''}${st ? `\n${st}` : ''}${!un && c.unlock ? `\nKhóa: ${c.unlock.text} (${costumeProgress(G.meta, c.unlock.kind)}/${c.unlock.value})` : ''}`, 230, 13);
      const b = button(this, x + 60, y + 86, 170, 46, worn ? t('costume.worn') : un ? t('costume.wear') : t('costume.locked'), () => { G.meta.costume = c.id; G.saveMeta(); G.logEvent('costume', { id: c.id }); this.build(); }, worn ? 'wood' : 'green', { id: `costume_${c.id}` });
      b.setEnabled(un && !worn);
    });
  }
}

export class WeaponsScene extends Overlay {
  constructor() { super('Weapons'); }
  create() { this.build(); }
  build() {
    this.children.removeAll(true); this.frame(t('weapon.title'));
    weapons.forEach((w, i) => {
      const x = 230 + (i % 3) * 410, y = 250 + Math.floor(i / 3) * 250; const usable = weaponUsable(G.meta, w.id); const dest = weaponDestinyUnlocked(G.meta, w.id); const eq = G.meta.weapon === w.id;
      const g = this.add.graphics(); g.fillStyle(eq ? 0xe8f5d0 : PAL.creamLo, 1).fillRoundedRect(x - 190, y - 110, 380, 230, 14).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 190, y - 110, 380, 230, 14);
      const ir = iconRef(this, w.icon); const im = this.add.image(x - 130, y - 20, ir.tex, ir.frame).setDisplaySize(90, 90); if (!dest) im.setTint(0x444444);
      darkTxt(this, x - 70, y - 96, w.name, 22, { fontStyle: '800' }); wrapText(this, x - 70, y - 62, w.desc, 250, 13);
      let label = eq ? t('weapon.equipped') : usable ? t('weapon.equip') : dest ? t('weapon.train') : t('weapon.locked');
      const b = button(this, x + 50, y + 86, 230, 46, label, () => {
        if (usable) { G.meta.weapon = w.id; G.saveMeta(); G.logEvent('weaponEquip', { id: w.id }); this.build(); }
        else if (dest) { const from = this.data0.from; this.scene.stop(); if (from) this.scene.stop(from); startTraining(this, w.id); }
      }, usable ? 'green' : 'orange', { id: `weapon_${w.id}` });
      b.setEnabled(!eq && (usable || dest));
    });
  }
}
export function startTraining(s: Phaser.Scene, weapon: WeaponId) {
  const r = newRun(G.meta, { seed: 7, weapon }); r.chapter = 1; r.money = 0; r.potions = r.potions.map(() => null);
  G.run = r; G.training = true; G.logEvent('training', { weapon });
  s.scene.stop('Hub'); s.scene.start('Run', { mode: 'training', run: r });
}

export class JournalScene extends Overlay {
  constructor() { super('Journal'); }
  tab = 'artifacts';
  create() { this.build(); }
  build() {
    this.children.removeAll(true); this.frame(t('journal.title'));
    const tabs: Array<[string, string]> = [['artifacts', t('journal.artifacts')], ['tablets', t('journal.tablets')], ['enemies', t('journal.enemies')], ['miracles', t('journal.miracles')]];
    tabs.forEach(([k, l], i) => button(this, 200 + i * 220, 120, 200, 46, l, () => { this.tab = k; this.build(); }, this.tab === k ? 'orange' : 'wood', { id: `jtab_${k}` }));
    const list: Array<{ id: string; name: string; icon: string; rar?: string }> =
      this.tab === 'artifacts' ? artifacts.map((a) => ({ id: a.id, name: a.name, icon: a.icon, rar: a.rarity })) : this.tab === 'tablets' ? tablets.map((a) => ({ id: a.id, name: a.name, icon: a.icon, rar: a.rarity }))
        : this.tab === 'enemies' ? [...enemies.map((e) => ({ id: e.id, name: e.name, icon: e.sprite })), ...bosses.map((b) => ({ id: b.id, name: b.name, icon: b.sprite }))] : miracles.map((m) => ({ id: m.id, name: m.name, icon: m.icon }));
    const seen = new Set((G.meta.journal as any)[this.tab] as string[]);
    darkTxt(this, 80, 150, `${[...seen].filter((x) => list.some((l) => l.id === x)).length}/${list.length}`, 18, { fontStyle: '800' });
    list.slice(0, 96).forEach((it, i) => {
      const x = 90 + (i % 16) * 70, y = 200 + Math.floor(i / 16) * 76; const known = seen.has(it.id);
      const g = this.add.graphics(); g.fillStyle(it.rar ? RARITY_COLOR[it.rar] : PAL.woodHi, known ? 1 : 0.3).fillRoundedRect(x - 30, y - 30, 60, 60, 10).lineStyle(2, PAL.outline, 1).strokeRoundedRect(x - 30, y - 30, 60, 60, 10);
      if (this.tab === 'enemies' && !known) { darkTxt(this, x, y, '?', 26).setOrigin(0.5); return; }
      const ir = iconRef(this, it.icon, this.tab === 'enemies' ? 'enemy' : 'icon');
      if (this.tab === 'enemies' && !this.textures.exists(ir.tex)) { darkTxt(this, x, y, it.name.slice(0, 6), 12).setOrigin(0.5); return; }
      const im = this.add.image(x, y, ir.tex, this.tab === 'enemies' ? 0 : ir.frame); const sc = Math.min(52 / (im.width || 1), 52 / (im.height || 1)); im.setScale(sc); if (!known) im.setTint(0x222222);
      im.setInteractive().on('pointerover', () => { this.tip?.destroy(); this.tip = darkTxt(this, 80, 660, known ? `${it.name}${this.tab === 'artifacts' ? ' — ' + itemDesc(it.id, 0) : ''}` : '???', 16); });
    });
  }
  tip: Phaser.GameObjects.Text | null = null;
}

export class SettingsScene extends Overlay {
  constructor() { super('Settings'); }
  create() {
    this.children.removeAll(true); this.frame(t('settings.title'), 600, 520);
    const m = G.meta.settings;
    button(this, 640, 250, 360, 60, m.mute ? t('settings.unmute') : t('settings.mute'), () => { setMute(!m.mute); G.logEvent('mute', { mute: G.meta.settings.mute }); this.create(); }, 'purple', { id: 'mute' });
    button(this, 640, 330, 360, 60, `${t('settings.damage')}: ${m.showDamage ? 'BẬT' : 'TẮT'}`, () => { m.showDamage = !m.showDamage; G.saveMeta(); this.create(); }, 'wood', { id: 'dmgnums' });
    if (canUseHardMode(G.meta)) button(this, 640, 410, 360, 60, `${t('hub.hard')}: ${G.meta.hardMode ? 'BẬT' : 'TẮT'}`, () => { G.meta.hardMode = !G.meta.hardMode; G.saveMeta(); G.logEvent('hardMode', { on: G.meta.hardMode }); this.create(); }, 'red', { id: 'hard' });
    else darkTxt(this, 640, 410, `${t('hub.hard')}: cần chiến thắng 1 lần${destiny.some((d) => d.grant.key === 'hardMode') ? ' + khắc Cổng Khó' : ''}`, 16).setOrigin(0.5);
    button(this, 640, 500, 360, 56, t('settings.reset'), () => { if ((this as any).confirmReset) { localStorage.clear(); location.reload(); } else { (this as any).confirmReset = true; toast(this, 'Nhấn lần nữa để xóa', '#ff7a66'); } }, 'red', { id: 'reset' });
  }
}

export class PickerScene extends Overlay {
  constructor() { super('Picker'); }
  page = 0;
  create() { this.build(); }
  build() {
    this.children.removeAll(true); this.frame(t('training.spawn'));
    const pool = [...artifactPool(G.meta), ...tablets.map((x) => x.id)];
    const per = 40; const items = pool.slice(this.page * per, this.page * per + per);
    items.forEach((id, i) => {
      const a = getArtifact(id); const def: any = a ?? tablets.find((x) => x.id === id);
      const x = 100 + (i % 10) * 108, y = 170 + Math.floor(i / 10) * 112;
      const g = this.add.graphics(); g.fillStyle(RARITY_COLOR[def.rarity], 1).fillRoundedRect(x - 44, y - 44, 88, 88, 12).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 44, y - 44, 88, 88, 12);
      const ir = iconRef(this, def.icon); const im = this.add.image(x, y - 6, ir.tex, ir.frame).setDisplaySize(64, 64).setInteractive({ useHandCursor: true });
      darkTxt(this, x, y + 30, def.name.slice(0, 12), 11).setOrigin(0.5);
      im.on('pointerup', () => { if (addItem(G.run!.grid, id)) { sfx('pickup'); toast(this, def.name, '#a6e070'); G.logEvent('trainingSpawn', { id }); } else { sfx('deny'); toast(this, t('inv.full'), '#ff7a66'); } });
    });
    if (pool.length > per) button(this, 640, 660, 200, 50, `Trang ${this.page + 1}/${Math.ceil(pool.length / per)}`, () => { this.page = (this.page + 1) % Math.ceil(pool.length / per); this.build(); }, 'wood', { id: 'page' });
  }
}

export class ResultsScene extends Phaser.Scene {
  constructor() { super('Results'); }
  create(d: any) {
    this.add.rectangle(640, 360, 1280, 720, 0x2a1b12);
    card(this, 640, 370, 640, 520); title(this, t('res.title'), 150);
    darkTxt(this, 640, 210, t('res.dead'), 26, { fontStyle: '800' }).setOrigin(0.5);
    const lines = [`${t('chapter')} ${d.chapter} — ${t('floor')} ${d.floor}`, `${t('res.floors')}: ${d.floors}`, `${t('res.bosses')}: ${d.bosses}`, `${t('res.kills')}: ${d.kills}`];
    lines.forEach((l, i) => darkTxt(this, 640, 270 + i * 40, l, 22).setOrigin(0.5));
    pill(this, 560, 450, 170, 'ic_sapphire', `+${d.sapphires}`);
    darkTxt(this, 640, 500, t('res.sapphires'), 18).setOrigin(0.5);
    button(this, 640, 580, 320, 64, t('res.toHub'), () => this.scene.start('Hub'), 'green', { id: 'toHub' });
    G.logEvent('results', d);
  }
}

export class EndingScene extends Phaser.Scene {
  constructor() { super('Ending'); }
  create(d: any) {
    this.add.rectangle(640, 360, 1280, 720, 0x1d1430);
    for (let i = 0; i < 80; i++) this.add.circle(Math.random() * 1280, Math.random() * 500, Math.random() * 2 + 1, 0xfff4dc, Math.random());
    const star = this.add.image(640, 120, tex(this, 'pj_star', 'proj').tex).setDisplaySize(110, 110); this.tweens.add({ targets: star, angle: 360, duration: 8000, repeat: -1 });
    txt(this, 640, 215, t('end.title'), 40, '#ffcb6b').setOrigin(0.5);
    txt(this, 640, 268, t('end.text'), 22).setOrigin(0.5);
    txt(this, 640, 310, `${t('end.hard')}  +${d?.sapphires ?? 0} Ngọc`, 22, '#a6e070').setOrigin(0.5);
    const cr = txt(this, 640, 352, t('end.credits'), 19, '#fff4dc', true, { align: 'center' }).setOrigin(0.5, 0).setAlpha(0);
    this.tweens.add({ targets: cr, alpha: 1, duration: 1500, delay: 600 });
    // the village celebrates: a strip of Làng Mây ground with the hero and friends around the campfire
    this.add.rectangle(640, 528, 1280, 8, 0x3b2416).setOrigin(0.5, 1).setDepth(1);
    if (this.textures.exists('ts_hub')) { const cells: Array<[number, number, number]> = []; for (let r = 11; r < 15; r++) for (let c = 0; c < 27; c++) cells.push([c, r, (c * 7 + r * 13) % 8]); bakeTiles(this, 'ts_hub', cells, 1296, 720, 0); }
    const P = (k: string, x: number, y: number, px: number, anchor: [number, number] = [0.5, 1], left = false) => { if (!this.textures.exists(k)) return; const sp = this.add.sprite(x, y, k); applyEntry(sp, k, px, anchor); sp.setDepth(y); playAnim(sp, k, 'idle'); if (left) face(sp, k, true); };
    P('hub_tree_a', 110, 650, 150); P('hub_tree_b', 1170, 660, 150); P('hub_bush_berry', 260, 640, 40); P('hub_flowers', 1010, 650, 36);
    P('hub_campfire', 640, 640, 70); P(getCostume(G.meta.costume)?.sprite ?? 'hero_bong', 560, 650, 46, [0.5, 0.92]);
    P('npc_elder', 470, 630, 44, [0.5, 0.9]); P('npc_bard', 730, 652, 44, [0.5, 0.9], true); P('npc_smith', 850, 630, 44, [0.5, 0.9], true); P('npc_tailor', 380, 655, 44, [0.5, 0.9]); P('cmp_sprout', 610, 690, 30, [0.5, 0.9]);
    sfx('win');
    button(this, 640, 478, 300, 58, t('res.toHub'), () => this.scene.start('Hub'), 'green', { id: 'toHub' });
    G.logEvent('ending', d);
  }
}
void stars;
