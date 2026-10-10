// Làng Mây hub: walkable island village with stations (layout follows art/sheets/mockup_hub_1280x720.png).
import Phaser from 'phaser';
import { G } from '../game/state';
import { Controls } from '../game/input';
import { tex, applyEntry, playAnim, face, MANIFEST, PAL, bakeTiles } from '../game/assets';
import { sfx } from '../game/audio';
import { txt, button, pill, toast } from '../ui/kit';
import { t } from '../systems/i18n';
import { newRun } from '../systems/run';
import { getCostume } from '../systems/registry';
import { weaponUsable, hasHomeRepairs, checkCostumeUnlocks } from '../systems/meta';
import { openOverlay } from './Overlay';
import { startTraining } from './meta';

interface Station { id: string; x: number; y: number; r: number; label: string; open: () => void }
export class HubScene extends Phaser.Scene {
  constructor() { super('Hub'); }
  ctl!: Controls; hero!: Phaser.GameObjects.Sprite; heroKey = 'hero_bong'; px = 640; py = 560; stations: Station[] = []; labels: Phaser.GameObjects.Text[] = []; prompt!: Phaser.GameObjects.Text;
  create() {
    G.run = null; G.training = false; this.stations = []; this.labels = [];
    if (!weaponUsable(G.meta, G.meta.weapon)) G.meta.weapon = 'swordshield';
    checkCostumeUnlocks(G.meta); G.saveMeta();
    this.ctl = new Controls(this, { touchButtons: false });
    this.drawIsland();
    const P = (k: string, x: number, y: number, px = 80, anchor: [number, number] = [0.5, 1], frame?: number) => { const s = this.add.sprite(x, y, tex(this, k, 'prop').tex, frame as any); applyEntry(s, k, px, anchor); s.setDepth(y); playAnim(s, k, 'idle'); return s; };
    // decor
    P('hub_dirt_a', 330, 350, 140); P('hub_dirt_b', 990, 400, 160); P('hub_dirt_a', 640, 520, 170); P('hub_dirt_b', 180, 480, 120);
    [[90, 210, 'hub_tree_a'], [170, 120, 'hub_tree_b'], [470, 130, 'hub_tree_a'], [800, 110, 'hub_tree_b'], [1190, 210, 'hub_tree_c'], [1210, 360, 'hub_tree_a'], [90, 400, 'hub_tree_c'], [1120, 620, 'hub_tree_b'], [380, 600, 'hub_tree_a']].forEach(([x, y, k]) => P(k as string, x as number, y as number, 150));
    [[160, 220], [140, 290], [830, 220], [880, 420]].forEach(([x, y]) => P('hub_mushrooms', x, y, 40));
    [[540, 370], [760, 400], [300, 410], [1090, 400]].forEach(([x, y]) => P('hub_bush_berry', x, y, 40));
    [[470, 175], [1040, 120], [790, 450]].forEach(([x, y]) => P('hub_rock', x, y, 40)); [[460, 170], [330, 460], [1080, 520]].forEach(([x, y]) => P('hub_flowers', x, y, 36));
    P('hub_pond', 250, 590, 200, [0.5, 0.6]);
    // stations
    const house = P('hub_house', 290, 250, 170, [0.5, 1], hasHomeRepairs(G.meta) ? 1 : 0);
    if (MANIFEST.hub_house?.type === 'sheet') { house.anims.stop(); house.setFrame(hasHomeRepairs(G.meta) ? 1 : 0); }
    P('hub_wardrobe', 440, 300, 80); P('hub_mirror', 515, 310, 80); P('hub_destiny_tree', 640, 290, 230); P('hub_tent_smith', 990, 290, 150);
    P('hub_journal_stand', 480, 470, 60); P('hub_campfire', 640, 470, 70); P('hub_portal', 845, 600, 130); P('hub_weapon_rack', 1050, 490, 80); P('hub_training_dummy', 1145, 470, 64);
    const npc = (k: string, x: number, y: number) => { const s = P(k, x, y, 44, [0.5, 0.9]); return s; };
    npc('npc_elder', 700, 330); npc('npc_tailor', 395, 330); npc('npc_smith', 920, 330); npc('npc_trainer', 1105, 500); npc('npc_bard', 700, 490); npc('npc_sleeper', 585, 495); npc('npc_merchant', 230, 460);
    const st = (id: string, x: number, y: number, label: string, open: () => void, r = 60) => { this.stations.push({ id, x, y, r, label, open }); };
    st('destiny', 640, 330, t('hub.destiny'), () => this.open('Destiny'), 80);
    st('talents', 515, 330, t('hub.talents'), () => this.open('Talents'));
    st('costumes', 440, 320, t('hub.costumes'), () => this.open('Costumes'));
    st('weapons', 1050, 510, t('hub.weapons'), () => this.open('Weapons'));
    st('journal', 480, 490, t('hub.journal'), () => this.open('Journal'));
    st('training', 1145, 490, t('hub.training'), () => startTraining(this, G.meta.weapon));
    st('portal', 845, 610, t('hub.portal'), () => this.startRun(), 70);
    // hero
    const ck = getCostume(G.meta.costume)?.sprite ?? 'hero_bong'; this.heroKey = ck; tex(this, ck, 'char');
    this.hero = this.add.sprite(this.px, this.py, ck); applyEntry(this.hero, ck, 46, [0.5, 0.92]); playAnim(this.hero, ck, 'idle');
    this.prompt = txt(this, 640, 600, '', 18, '#ffcb6b').setOrigin(0.5).setDepth(6000);
    this.buildUi();
    this.events.once('shutdown', () => this.ctl.destroy());
    this.events.on('resume', () => { this.ctl.clearPressed(); this.refreshUi(); });
    this.cameras.main.resetFX(); this.cameras.main.fadeIn(300);
    G.logEvent('hub', { sapphires: G.meta.sapphires });
  }
  drawIsland() {
    const T = tex(this, 'ts_hub', 'tile').tex;
    const inIsland = (c: number, r: number) => c >= 1 && c <= 25 && r >= 1 && r <= 13 && !((c <= 2 && r <= 2) || (c >= 24 && r <= 2) || (c <= 1 && r >= 12) || (c >= 25 && r >= 12));
    const cells: Array<[number, number, number]> = [];
    for (let r = 0; r < 15; r++) for (let c = 0; c < 27; c++) {
      let f: number; const me = inIsland(c, r);
      if (me) { const w = !inIsland(c - 1, r), e = !inIsland(c + 1, r), n = !inIsland(c, r - 1); f = n && w ? 30 : n && e ? 31 : w ? 28 : e ? 29 : ((c * 7 + r * 13) % 8); }
      else f = inIsland(c, r - 1) ? 26 : inIsland(c, r + 1) ? 27 : 24 + ((c + r) % 2);
      cells.push([c, r, f]);
    }
    bakeTiles(this, T, cells, 1296, 720, -10);
  }
  buildUi() {
    this.children.list.filter((o: any) => o.getData && o.getData('ui')).forEach((o) => o.destroy());
    const ui: Phaser.GameObjects.GameObject[] = [];
    ui.push(pill(this, 40, 34, 150, 'ic_sapphire', G.meta.sapphires));
    ui.push(button(this, 640, 32, 230, 46, t('hub.name').toUpperCase(), () => {}, 'orange', { id: 'hubTitle', size: 20 }));
    ui.push(button(this, 1236, 36, 60, 56, '', () => this.open('Settings'), 'wood', { icon: 'btn_pause', id: 'settings' }));
    ui.push(button(this, 1236, 140, 70, 70, '', () => this.open('Journal'), 'purple', { icon: 'node_artifact', id: 'journalBtn' }));
    ui.push(txt(this, 1236, 182, t('hub.journal'), 13).setOrigin(0.5));
    const bx = [306, 424, 542, 660, 778];
    const items: Array<[string, string, string, () => void]> = [['btn_attack', t('hub.training'), 'trainBtn', () => startTraining(this, G.meta.weapon)], ['wic_swordshield', t('hub.weapons'), 'weaponsBtn', () => this.open('Weapons')], ['st_critChance', t('hub.talents'), 'talentsBtn', () => this.open('Talents')], ['combo_companion', t('hub.costumes'), 'costumesBtn', () => this.open('Costumes')], ['node_levelup', t('hub.destinyShort'), 'destinyBtn', () => this.open('Destiny')]];
    const bar = this.add.graphics().setDepth(7000); bar.fillStyle(PAL.pill, 0.85).fillRoundedRect(240, 606, 800, 108, 18).lineStyle(3, PAL.outline, 1).strokeRoundedRect(240, 606, 800, 108, 18); ui.push(bar);
    items.forEach(([ic, l, id, fn], i) => { const b = button(this, bx[i], 660, 104, 92, '', fn, 'orange', { icon: ic, id }); b.label.setText(l).setFontSize(14).setY(28); ui.push(b); });
    const has = G.store.hasRun();
    const go = button(this, 935, 660, 180, 92, has ? t('menu.continue') : 'BẮT ĐẦU', () => this.startRun(), 'green', { id: 'startRun', size: 24 }); ui.push(go);
    if (has) ui.push(button(this, 935, 590, 180, 40, t('menu.newRun'), () => { G.clearRun(); this.startRun(); }, 'orange', { id: 'newRun', size: 16 }));
    if (G.meta.hardMode) ui.push(txt(this, 935, 715, t('hub.hard'), 13, '#ff7a66').setOrigin(0.5, 1));
    for (const o of ui) { (o as any).setData?.('ui', true); (o as any).setDepth?.(7001); }
  }
  refreshUi() { this.buildUi(); }
  open(key: string) { sfx('ui'); openOverlay(this, key, { onClose: () => this.scene.restart() }); }
  startRun() {
    const saved = G.loadRun();
    if (saved) { G.run = saved; G.logEvent('runContinue', { chapter: saved.chapter }); }
    else { G.run = newRun(G.meta, { weapon: G.meta.weapon, hard: G.meta.hardMode }); G.meta.stats.runs; G.saveRun(); G.logEvent('runStart', { weapon: G.meta.weapon, seed: G.run.seed, hard: G.run.hard }); }
    sfx('door'); this.cameras.main.fadeOut(250);
    this.cameras.main.once('camerafadeoutcomplete', () => this.scene.start('Run', { mode: 'run' }));
  }
  update(_t: number, dms: number) {
    const dt = Math.min(0.05, dms / 1000); this.ctl.update(this.px, this.py);
    if (this.ctl.consume('pause')) { this.open('Settings'); return; }
    const sp = 170; const mx = this.ctl.moveX, my = this.ctl.moveY;
    this.px = Phaser.Math.Clamp(this.px + mx * sp * dt, 80, 1200); this.py = Phaser.Math.Clamp(this.py + my * sp * dt, 110, 600);
    const moving = Math.hypot(mx, my) > 0.1;
    playAnim(this.hero, this.heroKey, moving ? 'run' : 'idle'); if (Math.abs(mx) > 0.1) face(this.hero, this.heroKey, mx < 0);
    this.hero.setPosition(this.px, this.py).setDepth(this.py);
    let near: Station | null = null; for (const s of this.stations) if (Math.hypot(s.x - this.px, s.y - this.py) < s.r) { near = s; break; }
    this.prompt.setText(near ? `${near.label} — ${t('hub.interact')}` : '').setPosition(this.px, this.py - 70);
    if (near && this.ctl.consume('interact')) { G.logEvent('station', { id: near.id }); near.open(); }
  }
}
void toast;
