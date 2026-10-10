// In-run HUD: HP/MP pills, dash pips, currency pills, potion belt, spell slots, weapon state, mini map, boss bar, combos.
import Phaser from 'phaser';
import { G } from '../game/state';
import { PAL, iconRef } from '../game/assets';
import { txt, bar, pill, button, darkPanel, type Bar, type Pill } from '../ui/kit';
import { t } from '../systems/i18n';
import { getPotion, getMiracle, getCombo, getChapter, getArtifact } from '../systems/registry';
import { resolve } from '../systems/inventory';
import { xpToNext } from '../systems/stats';
import { drawMap } from './overlays';
import type { RunScene } from './RunScene';
import { openOverlay } from './Overlay';
import { musicEnabled, setMusicEnabled } from '../game/audio';

export class HudScene extends Phaser.Scene {
  constructor() { super('Hud'); }
  hp!: Bar; mp!: Bar; xp!: Bar; money!: Pill; saph!: Pill; dice!: Pill; dashG!: Phaser.GameObjects.Graphics; lvl!: Phaser.GameObjects.Text;
  pots: Phaser.GameObjects.Image[] = []; potG!: Phaser.GameObjects.Graphics; spellG!: Phaser.GameObjects.Graphics; spellIcons: Phaser.GameObjects.Text[] = []; spellImgs: Phaser.GameObjects.Image[] = []; potKey!: Phaser.GameObjects.Text;
  bossBar!: Bar; bossName!: Phaser.GameObjects.Text; bossCont!: Phaser.GameObjects.Container; wpnTxt!: Phaser.GameObjects.Text;
  musicBtn: Phaser.GameObjects.Container | null = null; ck = { hp: '', mp: '', xp: '', dash: -1, pot: '', spell: '' }; // change keys: redraw HUD graphics only when values change (v2 perf)
  mini: Phaser.GameObjects.Container | null = null; miniKey = ''; comboTxt!: Phaser.GameObjects.Text; miracleC!: Phaser.GameObjects.Container; miracleKey = ''; statusTxt!: Phaser.GameObjects.Text;
  create() {
    const L = 16; this.ck = { hp: '', mp: '', xp: '', dash: -1, pot: '', spell: '' }; this.pots = []; this.spellIcons = []; this.spellImgs = []; this.mini = null; this.miniKey = ''; this.miracleKey = '';
    const hr = iconRef(this, 'ic_hp'); this.add.image(30, 32, hr.tex, hr.frame).setDisplaySize(30, 30);
    const mr = iconRef(this, 'ic_mp'); this.add.image(30, 66, mr.tex, mr.frame).setDisplaySize(28, 28);
    this.hp = bar(this, 46, 20, 210, 24, PAL.hp, 0xff9a8a); this.mp = bar(this, 46, 54, 170, 20, PAL.mp, 0xa8dcff);
    this.xp = bar(this, 46, 82, 170, 12, PAL.xp); this.lvl = txt(this, 224, 76, '', 15);
    this.dashG = this.add.graphics();
    this.money = pill(this, 290, 32, 120, 'ic_money', 0); this.saph = pill(this, 430, 32, 100, 'ic_sapphire', 0); this.dice = pill(this, 550, 32, 90, 'ic_dice', 0);
    if (!G.training) darkPanel(this, 1040, 8, 230, 210, 0.85); // mini-map panel (no map in the training room)
    this.potG = this.add.graphics(); this.spellG = this.add.graphics();
    for (let i = 0; i < 5; i++) this.pots.push(this.add.image(0, 0, iconRef(this, 'pot_heal').tex).setVisible(false));
    for (let i = 0; i < 2; i++) { this.spellImgs.push(this.add.image(0, 0, iconRef(this, 'btn_special').tex).setVisible(false)); this.spellIcons.push(txt(this, 0, 0, '', 13).setOrigin(1, 1)); }
    this.potKey = txt(this, 0, 0, 'R', 13).setOrigin(1, 1);
    this.wpnTxt = txt(this, L, 620, '', 16);
    this.statusTxt = txt(this, L, 122, '', 14, '#ffcb6b');
    this.comboTxt = txt(this, 1270, 280, '', 14, '#ffffff', true, { align: 'right' }).setOrigin(1, 0);
    this.miracleC = this.add.container(0, 0);
    this.bossCont = this.add.container(640, 190).setVisible(false);
    this.bossName = txt(this, 0, -22, '', 22).setOrigin(0.5); this.bossBar = bar(this, -300, -6, 600, 22, PAL.red, 0xff9a8a);
    this.bossCont.add([this.bossName, this.bossBar]);
    button(this, 1000, 30, 54, 50, '', () => openOverlay(this.scene.get('Run'), 'Pause', {}), 'wood', { icon: 'btn_pause', id: 'hudPause' });
    this.musicBtn = button(this, 940, 30, 54, 50, '♪', () => { setMusicEnabled(!musicEnabled()); this.musicBtn?.setAlpha(musicEnabled() ? 1 : 0.45); }, 'wood', { id: 'hudMusic' }); this.musicBtn.setAlpha(musicEnabled() ? 1 : 0.45);
    button(this, 1234, 250, 58, 54, '', () => openOverlay(this.scene.get('Run'), 'Inventory', { onClose: () => { const rs = this.scene.get('Run') as RunScene; rs.refreshLoadout(false); G.saveRun(); } }), 'orange', { icon: 'btn_bag', id: 'hudBag' });
  }
  update() {
    const rs = this.scene.get('Run') as RunScene; const r = G.run; if (!r || !rs || !rs.ready || !rs.stats) return;
    const s = rs.stats;
    const hpLabel = `${Math.ceil(Math.max(0, r.hp))}/${s.maxHp}${rs.shield > 0 ? ` +${Math.ceil(rs.shield)} khiên` : ''}`; const hk = `${Math.round(r.hp * 4)}|${hpLabel}`;
    if (hk !== this.ck.hp) { this.ck.hp = hk; this.hp.setValue(r.hp, s.maxHp, hpLabel); }
    const mk2 = `${Math.round(r.mp * 4)}|${s.maxMp}`; if (mk2 !== this.ck.mp) { this.ck.mp = mk2; this.mp.setValue(r.mp, s.maxMp); }
    const xk = `${r.xp}|${r.level}`; if (xk !== this.ck.xp) { this.ck.xp = xk; this.xp.setValue(r.xp, xpToNext(r.level), ''); this.lvl.setText(`${t('hud.level')} ${r.level}`); }
    const dk = s.dashCount * 100 + rs.dashes; if (dk !== this.ck.dash) { this.ck.dash = dk; this.dashG.clear(); for (let i = 0; i < s.dashCount; i++) { const on = i < rs.dashes; this.dashG.fillStyle(on ? 0x8fe0ff : 0x3a2a20, 1).fillCircle(230 + i * 18, 64, 7).lineStyle(2, PAL.outline, 1).strokeCircle(230 + i * 18, 64, 7); } }
    this.money.set(r.money); this.saph.set(G.meta.sapphires); this.dice.set(r.dice);
    // potions belt (bottom centre)
    const n = r.potions.length; const bx = 46; const pk = `${r.potions.join(',')}|${r.mysteryKnown}`; const potDirty = pk !== this.ck.pot; this.ck.pot = pk;
    if (potDirty) { this.potG.clear(); this.potG.fillStyle(PAL.pill, 0.8).fillRoundedRect(12, 642, 60 * n + 140, 70, 14).lineStyle(3, PAL.outline, 1).strokeRoundedRect(12, 642, 60 * n + 140, 70, 14);
    r.potions.forEach((p, i) => {
      const x = bx + i * 60, y = 676; this.potG.fillStyle(PAL.cream, 1).fillRoundedRect(x - 24, y - 24, 48, 48, 10).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 24, y - 24, 48, 48, 10);
      const im = this.pots[i]; if (!im) return;
      if (p) { const def = getPotion(p); const ir = iconRef(this, def?.icon ?? 'pot_heal'); im.setTexture(ir.tex, ir.frame).setDisplaySize(38, 38).setPosition(x, y).setVisible(true); if (def?.action === 'mystery' && r.mysteryKnown) im.setTint(0xd8ffd8); else im.clearTint(); }
      else im.setVisible(false);
    });
    }
    const fp = r.potions.findIndex((p) => p); this.potKey.setVisible(fp >= 0).setPosition(bx + Math.max(0, fp) * 60 + 22, 676 + 24);
    // spells (bottom right of belt)
    let sk = `${n}`; for (let i = 0; i < 2; i++) { const sl = rs.spells[i]; sk += `|${sl ? sl.source : '-'}:${sl && rs.spellCd[i] > 0 ? Math.ceil(48 * Math.min(1, rs.spellCd[i] / sl.cooldown)) : 0}`; }
    if (sk !== this.ck.spell) { this.ck.spell = sk; this.spellG.clear();
    for (let i = 0; i < 2; i++) {
      const x = 46 + n * 60 + 10 + i * 60, y = 676; const sl = rs.spells[i];
      this.spellG.fillStyle(sl ? PAL.purple : PAL.pill, 0.9).fillRoundedRect(x - 24, y - 24, 48, 48, 10).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 24, y - 24, 48, 48, 10);
      if (sl && rs.spellCd[i] > 0) this.spellG.fillStyle(0x000000, 0.5).fillRoundedRect(x - 24, y - 24, 48, 48 * Math.min(1, rs.spellCd[i] / sl.cooldown), 10);
      const im = this.spellImgs[i]; const src = sl ? getArtifact(sl.source.split('<')[0]) : undefined;
      if (src) { const ir = iconRef(this, src.icon); im.setTexture(ir.tex, ir.frame).setDisplaySize(40, 40).setPosition(x, y - 2).setVisible(true).setAlpha(rs.spellCd[i] > 0 ? 0.55 : 1); } else im.setVisible(false);
      this.spellIcons[i].setPosition(x + 22, y + 24).setText(`${i + 1}`);
    }
    }
    // weapon state
    const w = rs.wcfg; const ws = rs.ws; let wl = `${w.def.name}`;
    if (w.magazine > 0) wl += ws.reloading > 0 ? `  ${t('hud.reload')}…` : `  ${'▮'.repeat(ws.ammo)}${'▯'.repeat(Math.max(0, w.magazine - ws.ammo))}`;
    if (w.id === 'dagger') wl += ws.furyT > 0 ? `  CUỒNG NỘ ${ws.furyT.toFixed(1)}s` : `  Nộ ${Math.round(ws.fury)}%`;
    if (ws.charging) wl += `  Tụ lực ${ws.charge.toFixed(2)}s`;
    if (ws.guarding) wl += '   khiên Đỡ';
    this.wpnTxt.setText(wl);
    this.statusTxt.setText(r.buffs.map((b) => `${b.stat} +${b.value} (${Math.ceil(b.t)}s)`).join('  '));
    // boss bar
    const b = rs.bossRef && !rs.bossRef.dead ? rs.bossRef : null;
    this.bossCont.setVisible(!!b);
    if (b) { this.bossName.setText(`${b.boss!.name} — ${b.boss!.title}`); this.bossBar.setValue(Math.max(0, b.hp), b.maxHp, `${Math.ceil(Math.max(0, b.hp))}`); }
    // mini map (top right)
    const key = `${r.chapter}-${r.floor}-${r.pos}-${r.visited.length}-${G.training}`;
    if (key !== this.miniKey) { this.miniKey = key; this.mini?.destroy(); if (!G.training) { this.mini = drawMap(this, r, 1155, 118, 0.5); this.mini.add(txt(this, 0, -100, `${getChapter(r.chapter).name.toUpperCase()} ${r.chapter}-${r.floor}`, 15).setOrigin(0.5)); } }
    // combos & miracles
    if (this.game.getFrame() % 20 === 0) {
      const res = resolve(r.grid);
      this.comboTxt.setText(res.activeCombos.map((c) => `${getCombo(c.id)?.name ?? c.id} ★${c.tier}`).join('\n'));
      const mk = r.miracles.join(','); if (mk !== this.miracleKey) { this.miracleKey = mk; this.miracleC.removeAll(true); r.miracles.forEach((id, i) => { const m = getMiracle(id); if (m) { const ir = iconRef(this, m.icon); this.miracleC.add(this.add.image(1250 - i * 36, 380, ir.tex, ir.frame).setDisplaySize(32, 32)); } }); }
    }
    void getChapter;
  }
}
