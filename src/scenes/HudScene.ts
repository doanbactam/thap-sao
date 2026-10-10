// In-run HUD: HP/MP pills, dash pips, currency pills, potion belt, spell slots, weapon state, mini map, boss bar, combos.
import Phaser from 'phaser';
import { G } from '../game/state';
import { PAL, iconRef } from '../game/assets';
import { txt, bar, pill, button, darkPanel, padHit, type Bar, type Pill } from '../ui/kit';
import { hudLayout, quickBar, type HudLayout } from '../ui/hudLayout';
import { safeInsets, onSafeArea } from '../ui/safeArea';
import { isTouchDevice } from '../game/input';
import { t } from '../systems/i18n';
import { getPotion, getMiracle, getCombo, getChapter, getArtifact } from '../systems/registry';
import { resolve } from '../systems/inventory';
import { xpToNext } from '../systems/stats';
import { Minimap } from '../ui/mapView';
import type { RunScene } from './RunScene';
import { openOverlay } from './Overlay';
import { musicEnabled, setMusicEnabled } from '../game/audio';
import { SKILL_KEYS, cooldownFrac, spellInfo, specialInfo, tooltipLines, type SkillKey } from '../systems/skills';
import { costOf } from '../systems/skillFx';
import { getWeapon } from '../systems/registry';

const SKILL_LABEL: Record<SkillKey, string> = { spell1: '1', spell2: '2', special: 'F' };
const PIE: Phaser.Math.Vector2[] = Array.from({ length: 52 }, () => new Phaser.Math.Vector2());
/** Clockwise radial cooldown sweep from 12 o'clock covering `frac` of a square of half-size h (polygon clipped to the square). */
function squarePie(g: Phaser.GameObjects.Graphics, x: number, y: number, h: number, frac: number) {
  const steps = Math.max(2, Math.ceil(48 * frac)); const a0 = -Math.PI / 2, a1 = a0 + Math.PI * 2 * frac; PIE[0].set(x, y);
  for (let i = 0; i <= steps; i++) { const a = a0 + (a1 - a0) * (i / steps); const c = Math.cos(a), s = Math.sin(a); const t = h / Math.max(Math.abs(c), Math.abs(s)); PIE[i + 1].set(x + c * t, y + s * t); }
  g.fillPoints(PIE.slice(0, steps + 2), true);
}
const LONG_PRESS = 450; // ms of holding a skill (key or touch) before its tooltip shows

export class HudScene extends Phaser.Scene {
  constructor() { super('Hud'); }
  hp!: Bar; mp!: Bar; xp!: Bar; money!: Pill; saph!: Pill; dice!: Pill; dashG!: Phaser.GameObjects.Graphics; lvl!: Phaser.GameObjects.Text;
  pots: Phaser.GameObjects.Image[] = []; potG!: Phaser.GameObjects.Graphics; spellG!: Phaser.GameObjects.Graphics; spellIcons: Phaser.GameObjects.Text[] = []; spellImgs: Phaser.GameObjects.Image[] = []; spellCost: Phaser.GameObjects.Text[] = []; spellCdTxt: Phaser.GameObjects.Text[] = []; spellZones: Phaser.GameObjects.Zone[] = []; mpFlash!: Phaser.GameObjects.Graphics; hoverKey: SkillKey | null = null; tip!: Phaser.GameObjects.Container; tipBg!: Phaser.GameObjects.Graphics; tipTxt!: Phaser.GameObjects.Text; tipKey = ''; skillView: Record<string, unknown> = {}; potKey!: Phaser.GameObjects.Text;
  bossBar!: Bar; bossName!: Phaser.GameObjects.Text; bossCont!: Phaser.GameObjects.Container; wpnTxt!: Phaser.GameObjects.Text;
  musicBtn: Phaser.GameObjects.Container | null = null; ck = { hp: '', mp: '', xp: '', dash: -1, pot: '', spell: '' }; // change keys: redraw HUD graphics only when values change (v2 perf)
  lay!: HudLayout; touchUi = false; // v2 layout: every position below comes from src/ui/hudLayout.ts (safe-area aware)
  mini: Minimap | null = null; miniKey = ''; comboTxt!: Phaser.GameObjects.Text; miracleC!: Phaser.GameObjects.Container; miracleKey = ''; statusTxt!: Phaser.GameObjects.Text;
  create() {
    const ins = safeInsets(); this.touchUi = isTouchDevice(); const Y = hudLayout(ins, this.touchUi, G.run?.potions.length ?? 2); this.lay = Y; this.ck = { hp: '', mp: '', xp: '', dash: -1, pot: '', spell: '' }; this.pots = []; this.spellIcons = []; this.spellImgs = []; this.spellCost = []; this.spellCdTxt = []; this.spellZones = []; this.hoverKey = null; this.tipKey = ''; this.mini = null; this.miniKey = ''; this.miracleKey = '';
    const hr = iconRef(this, 'ic_hp'); this.add.image(Y.hpIcon.x, Y.hpIcon.y, hr.tex, hr.frame).setDisplaySize(30, 30);
    const mr = iconRef(this, 'ic_mp'); this.add.image(Y.mpIcon.x, Y.mpIcon.y, mr.tex, mr.frame).setDisplaySize(28, 28);
    this.hp = bar(this, Y.hp.x, Y.hp.y, Y.hp.w, Y.hp.h, PAL.hp, 0xff9a8a); this.mp = bar(this, Y.mp.x, Y.mp.y, Y.mp.w, Y.mp.h, PAL.mp, 0xa8dcff);
    this.xp = bar(this, Y.xp.x, Y.xp.y, Y.xp.w, Y.xp.h, PAL.xp); this.lvl = txt(this, Y.lvl.x, Y.lvl.y, '', 15);
    this.dashG = this.add.graphics();
    const P = Y.pills; this.money = pill(this, P.money.x, P.money.y, P.money.w, 'ic_money', 0); this.saph = pill(this, P.saph.x, P.saph.y, P.saph.w, 'ic_sapphire', 0); this.dice = pill(this, P.dice.x, P.dice.y, P.dice.w, 'ic_dice', 0);
    // mini-map panel: drawn by the v2 Minimap (src/ui/mapView.ts, rect src/ui/layout.ts MINIMAP), none in the training room
    this.potG = this.add.graphics(); this.spellG = this.add.graphics();
    for (let i = 0; i < 5; i++) this.pots.push(this.add.image(0, 0, iconRef(this, 'pot_heal').tex).setVisible(false));
    // skill slots: spell 1, spell 2, weapon special — icon, radial cooldown sweep, cost, key label, hover / long-press tooltip
    for (let i = 0; i < 3; i++) {
      this.spellImgs.push(this.add.image(0, 0, iconRef(this, 'btn_special').tex).setVisible(false));
      this.spellIcons.push(txt(this, 0, 0, '', 13).setOrigin(1, 1)); this.spellCost.push(txt(this, 0, 0, '', 11, '#8fd0ff').setOrigin(0, 0));
      this.spellCdTxt.push(txt(this, 0, 0, '', 15).setOrigin(0.5));
      const z = this.add.zone(0, 0, 48, 48).setInteractive(); const k = SKILL_KEYS[i];
      z.on('pointerover', () => (this.hoverKey = k)); z.on('pointerout', () => { if (this.hoverKey === k) this.hoverKey = null; }); this.spellZones.push(z);
    }
    this.mpFlash = this.add.graphics();
    this.tip = this.add.container(0, 0).setDepth(50).setVisible(false); this.tipBg = this.add.graphics(); this.tipTxt = txt(this, 10, 8, '', 13, '#fff4dc', true, { lineSpacing: 2 }); this.tip.add([this.tipBg, this.tipTxt]);
    this.potKey = txt(this, 0, 0, 'R', 13).setOrigin(1, 1);
    this.wpnTxt = txt(this, Y.weaponLabel.x, Y.weaponLabel.y, '', 16);
    this.statusTxt = txt(this, Y.status.x, Y.status.y, '', 14, '#ffcb6b');
    this.comboTxt = txt(this, Y.combos.x, Y.combos.y, '', 14, '#ffffff', true, { align: Y.combos.align }).setOrigin(Y.combos.align === 'right' ? 1 : 0, 0);
    this.miracleC = this.add.container(0, 0);
    this.bossCont = this.add.container(Y.boss.x, Y.boss.y).setVisible(false);
    this.bossName = txt(this, 0, -22, '', 22).setOrigin(0.5); this.bossBar = bar(this, -Y.boss.w / 2, -6, Y.boss.w, 22, PAL.red, 0xff9a8a);
    this.bossCont.add([this.bossName, this.bossBar]);
    const cx = (r: { x: number; w: number }) => r.x + r.w / 2, cy = (r: { y: number; h: number }) => r.y + r.h / 2;
    const pb = button(this, cx(Y.pause), cy(Y.pause), Y.pause.w, Y.pause.h, '', () => openOverlay(this.scene.get('Run'), 'Pause', {}), 'wood', { icon: 'btn_pause', id: 'hudPause' });
    this.musicBtn = button(this, cx(Y.music), cy(Y.music), Y.music.w, Y.music.h, '♪', () => { setMusicEnabled(!musicEnabled()); this.musicBtn?.setAlpha(musicEnabled() ? 1 : 0.45); }, 'wood', { id: 'hudMusic' }); this.musicBtn.setAlpha(musicEnabled() ? 1 : 0.45);
    const bagB = button(this, cx(Y.bag), cy(Y.bag), Y.bag.w, Y.bag.h, '', () => openOverlay(this.scene.get('Run'), 'Inventory', { onClose: () => { const rs = this.scene.get('Run') as RunScene; rs.refreshLoadout(false); G.saveRun(); } }), 'orange', { icon: 'btn_bag', id: 'hudBag' });
    if (this.touchUi) { padHit(pb, 80, Y.pause.h + 8); padHit(this.musicBtn, 80, Y.music.h + 8); padHit(bagB, 96, 92); for (const z of this.spellZones) padHit(z, 58, 66); }
    // re-anchor on a safe-area change (rotation / cutout): the HUD is stateless (reads G every frame), so a restart is enough
    const un = onSafeArea(() => { if (this.scene.isActive()) this.scene.restart(); }); this.events.once('shutdown', un);
  }
  update() {
    const rs = this.scene.get('Run') as RunScene; const r = G.run; if (!r || !rs || !rs.ready || !rs.stats) return;
    const s = rs.stats;
    const hpLabel = `${Math.ceil(Math.max(0, r.hp))}/${s.maxHp}${rs.shield > 0 ? ` +${Math.ceil(rs.shield)} khiên` : ''}`; const hk = `${Math.round(r.hp * 4)}|${hpLabel}`;
    if (hk !== this.ck.hp) { this.ck.hp = hk; this.hp.setValue(r.hp, s.maxHp, hpLabel); }
    const mk2 = `${Math.round(r.mp * 4)}|${s.maxMp}`; if (mk2 !== this.ck.mp) { this.ck.mp = mk2; this.mp.setValue(r.mp, s.maxMp); }
    const xk = `${r.xp}|${r.level}`; if (xk !== this.ck.xp) { this.ck.xp = xk; this.xp.setValue(r.xp, xpToNext(r.level), ''); this.lvl.setText(`${t('hud.level')} ${r.level}`); }
    const dk = s.dashCount * 100 + rs.dashes; if (dk !== this.ck.dash) { this.ck.dash = dk; this.dashG.clear(); for (let i = 0; i < s.dashCount; i++) { const on = i < rs.dashes; const D = this.lay.dash; this.dashG.fillStyle(on ? 0x8fe0ff : 0x3a2a20, 1).fillCircle(D.x + i * D.step, D.y, 7).lineStyle(2, PAL.outline, 1).strokeCircle(D.x + i * D.step, D.y, 7); } }
    this.money.set(r.money); this.saph.set(G.meta.sapphires); this.dice.set(r.dice);
    // potions belt (bottom centre)
    const n = r.potions.length; const qb = quickBar(safeInsets(), n); const qr = qb.rect; rs.ctl.quickPots = n; const pk = `${r.potions.join(',')}|${r.mysteryKnown}|${qr.x},${qr.y}`; const potDirty = pk !== this.ck.pot; this.ck.pot = pk;
    if (potDirty) { this.potG.clear(); this.potG.fillStyle(PAL.pill, 0.8).fillRoundedRect(qr.x, qr.y, qr.w, qr.h, 14).lineStyle(3, PAL.outline, 1).strokeRoundedRect(qr.x, qr.y, qr.w, qr.h, 14);
    r.potions.forEach((p, i) => {
      const x = qb.potX(i), y = qb.cy; this.potG.fillStyle(PAL.cream, 1).fillRoundedRect(x - 24, y - 24, 48, 48, 10).lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 24, y - 24, 48, 48, 10);
      const im = this.pots[i]; if (!im) return;
      if (p) { const def = getPotion(p); const ir = iconRef(this, def?.icon ?? 'pot_heal'); im.setTexture(ir.tex, ir.frame).setDisplaySize(38, 38).setPosition(x, y).setVisible(true); if (def?.action === 'mystery' && r.mysteryKnown) im.setTint(0xd8ffd8); else im.clearTint(); }
      else im.setVisible(false);
    });
    }
    const fp = r.potions.findIndex((p) => p); this.potKey.setVisible(fp >= 0 && !this.touchUi).setPosition(qb.potX(Math.max(0, fp)) + 22, qb.cy + 24);
    this.drawSkills(rs, n);
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
    if (this.miniKey !== 'v2') { this.miniKey = 'v2'; this.mini = new Minimap(this, () => openOverlay(this.scene.get('Run'), 'Map', {}), safeInsets); } // v2 map (docs/V2_MAP.md)
    this.mini!.update(r, G.training); void key;
    // combos & miracles
    if (this.game.getFrame() % 20 === 0) {
      const res = resolve(r.grid);
      this.comboTxt.setText(res.activeCombos.map((c) => `${getCombo(c.id)?.name ?? c.id} ★${c.tier}`).join('\n'));
      const M = this.lay.miracles; const mk = r.miracles.join(','); if (mk !== this.miracleKey) { this.miracleKey = mk; this.miracleC.removeAll(true); r.miracles.forEach((id, i) => { const m = getMiracle(id); if (m) { const ir = iconRef(this, m.icon); this.miracleC.add(this.add.image(i * M.step, 0, ir.tex, ir.frame).setDisplaySize(32, 32)); } }); }
      this.miracleC.setPosition(M.x, this.comboTxt.y + (this.comboTxt.text ? this.comboTxt.height + 22 : 16)); // miracle row follows the combo list
    }
    void getChapter;
  }
  /** Spell 1 / spell 2 / weapon special slots: radial cooldown sweep, MP-insufficient dim + deny flash, ready pulse, key + cost labels, tooltip. */
  drawSkills(rs: RunScene, n: number) {
    const cs = rs.casts; const r = G.run!; const now = performance.now(); const ctl = rs.ctl;
    let key = `${n}|${Math.floor(r.mp)}`; const view: Record<string, unknown> = {};
    for (let i = 0; i < 3; i++) { const k = SKILL_KEYS[i]; const s = cs.slots[k]; key += `|${k === 'special' ? rs.wcfg.id : rs.spells[i]?.source ?? '-'}:${Math.ceil(64 * cooldownFrac(s.cd, s.cdMax))}:${s.pulse > 0 ? Math.round(s.pulse * 30) : 0}:${s.deny > 0 ? Math.round(s.deny * 30) : 0}:${ctl.skillHeld[k] ? 1 : 0}:${s.cd > 0 ? s.cd.toFixed(1) : ''}`; }
    if (key !== this.ck.spell) {
      this.ck.spell = key; const g = this.spellG; g.clear(); this.mpFlash.clear(); const qb = quickBar(safeInsets(), n); const MP = this.lay.mp;
      for (let i = 0; i < 3; i++) {
        const k = SKILL_KEYS[i]; const s = cs.slots[k]; const x = qb.skillX(i), y = qb.cy; const special = k === 'special';
        const sl = special ? null : rs.spells[i]; const hasIt = special || !!sl; const cost = costOf(rs as any, k); const lowMp = hasIt && r.mp < cost; const frac = cooldownFrac(s.cd, s.cdMax);
        g.fillStyle(!hasIt ? PAL.pill : special ? PAL.orangeLo : PAL.purple, 0.9).fillRoundedRect(x - 24, y - 24, 48, 48, 10).lineStyle(3, ctl.skillHeld[k] && hasIt ? 0xfff3b0 : PAL.outline, 1).strokeRoundedRect(x - 24, y - 24, 48, 48, 10);
        const im = this.spellImgs[i]; const src = special ? null : sl ? getArtifact(sl.source.split('<')[0]) : undefined;
        const icon = special ? (getWeapon(rs.wcfg.id)?.icon ?? 'btn_special') : src?.icon;
        if (icon) { const ir = iconRef(this, icon); im.setTexture(ir.tex, ir.frame).setDisplaySize(40, 40).setPosition(x, y - 2).setVisible(true).setAlpha(frac > 0 ? 0.6 : 1); if (lowMp) im.setTint(0x7f9fd8); else im.clearTint(); } else im.setVisible(false);
        if (frac > 0) squarePie(g.fillStyle(0x000000, 0.55), x, y, 23, frac); // radial sweep, clipped to the slot square
        if (frac > 0) g.lineStyle(3, PAL.outline, 1).strokeRoundedRect(x - 24, y - 24, 48, 48, 10).lineStyle(3, 0xfff3b0, 0.9).beginPath().arc(x, y, 21, -Math.PI / 2 + Math.PI * 2 * frac, Math.PI * 1.5).strokePath();
        if (lowMp) g.fillStyle(0x2a5a9a, 0.35).fillRoundedRect(x - 24, y - 24, 48, 48, 10);
        if (s.deny > 0) g.lineStyle(5, 0xff4a4a, Math.min(1, s.deny / 0.2)).strokeRoundedRect(x - 27, y - 27, 54, 54, 12);
        if (s.pulse > 0) { const q = 1 - s.pulse / 0.35; g.lineStyle(4, 0xffffff, 1 - q).strokeRoundedRect(x - 24 - q * 10, y - 24 - q * 10, 48 + q * 20, 48 + q * 20, 12); }
        if (s.deny > 0 && s.denyReason === 'mp') this.mpFlash.lineStyle(4, 0xff4a4a, Math.min(1, s.deny / 0.2)).strokeRoundedRect(MP.x - 4, MP.y - 4, MP.w + 8, MP.h + 8, 10);
        this.spellIcons[i].setPosition(x + 22, y + 24).setText(ctl.touch ? '' : SKILL_LABEL[k]);
        this.spellCost[i].setPosition(x - 22, y - 23).setText(hasIt && cost > 0 ? `${cost}` : '').setColor(lowMp ? '#ff8a7a' : '#8fd0ff');
        this.spellCdTxt[i].setPosition(x, y).setText(s.cd > 0 ? (s.cd >= 10 ? `${Math.ceil(s.cd)}` : s.cd.toFixed(1)) : '');
        this.spellZones[i].setPosition(x, y);
        view[k] = { frac: +frac.toFixed(3), lowMp, deny: s.deny > 0, pulse: s.pulse > 0, x, y };
      }
      this.skillView = view;
    }
    // tooltip: hover, or a long press (key or touch) of a skill
    let tk: SkillKey | null = this.hoverKey; let tx = 0, ty = 0;
    for (const k of SKILL_KEYS) if (ctl.skillHeld[k] && now - ctl.skillSince[k] >= (ctl.touch ? LONG_PRESS : LONG_PRESS * 2)) tk = k; // keys: 900 ms so a normal aim-hold keeps the preview clear
    if (tk) {
      const i = SKILL_KEYS.indexOf(tk); const special = tk === 'special'; const sl = special ? null : rs.spells[i];
      if (special || sl) {
        const st = rs.stats; const art = sl ? getArtifact(sl.source.split('<')[0]) : undefined;
        const info = special ? specialInfo(rs.wcfg.id, rs.wcfg.specialCost, st[rs.wcfg.element], { ...st, damagePct: (st.damagePct ?? 0) + rs.wcfg.damagePct }, rs.wcfg.magicShare)
          : spellInfo(tk, art?.name ?? sl!.spell, sl!.spell, sl!.power, sl!.mpCost, sl!.cooldown, st, rs.sp);
        const lines = tooltipLines(info); const tkey = `${tk}|${lines.join('|')}`;
        if (tkey !== this.tipKey) { this.tipKey = tkey; this.tipTxt.setText(lines); const w = Math.max(180, this.tipTxt.width + 20), h = this.tipTxt.height + 16; this.tipBg.clear().fillStyle(PAL.pill, 0.95).fillRoundedRect(0, 0, w, h, 10).lineStyle(3, PAL.outline, 1).strokeRoundedRect(0, 0, w, h, 10); this.tipTxt.setColor('#fff4dc'); (this.tip as any).tw = w; (this.tip as any).th = h; }
        const b = ctl.touch ? ctl.skillButtons[tk] : undefined;
        if (b && ctl.skillHeld[tk]) { tx = b.c.x - (this.tip as any).tw / 2; ty = b.c.y - b.r - 14 - (this.tip as any).th; }
        else { const qb = quickBar(safeInsets(), n); tx = qb.skillX(i) - 24; ty = qb.rect.y - 8 - (this.tip as any).th; }
        const T0 = this.lay.tooltipMin, T1 = this.lay.tooltipMax; this.tip.setPosition(Phaser.Math.Clamp(tx, T0.x, T1.x - (this.tip as any).tw), Math.max(T0.y, ty)).setVisible(true);
        (this.skillView as any).tip = { key: tk, lines };
      } else this.tip.setVisible(false);
    } else { this.tip.setVisible(false); (this.skillView as any).tip = null; }
  }
}
