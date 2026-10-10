// Unified input: keyboard + mouse, touch (floating joystick + buttons), and debug-simulated input.
import Phaser from 'phaser';
import { PAL, iconRef } from './assets';
import { txt } from '../ui/kit';
import { unlockAudio } from './audio';
import { aimFromDrag, SKILL_KEYS, type SkillKey } from '../systems/skills';

export type Act = 'dash' | 'potion' | 'inventory' | 'spell1' | 'spell2' | 'interact' | 'pause' | 'map' | 'reload';
export interface SimInput { move?: [number, number]; aim?: number; attack?: boolean; special?: boolean; guard?: boolean; until: number; press?: Act[]; spell1?: boolean; spell2?: boolean; drag?: { key: SkillKey; dx: number; dy: number } }
export const SIM: { cur: SimInput | null; queue: Act[] } = { cur: null, queue: [] };
export const isTouchDevice = () => (typeof window !== 'undefined') && (('ontouchstart' in window) || navigator.maxTouchPoints > 0 || /[?&]touch=1/.test(location.search));

export class Controls {
  moveX = 0; moveY = 0; aim = 0; aimSet = false;
  attack = false; special = false; guard = false;
  private pressed = new Set<Act>(); private keys: Record<string, Phaser.Input.Keyboard.Key> = {};
  private mouseAttack = false; private mouseGuard = false; private lastMouse = 0;
  private joy: { id: number; bx: number; by: number; dx: number; dy: number } | null = null;
  private touchHeld = { attack: false, special: false, guard: false };
  private touchUi: Phaser.GameObjects.Container | null = null; private joyG: Phaser.GameObjects.Graphics | null = null;
  touch = isTouchDevice();
  // ---- v2 skills: hold-to-aim, release-to-cast, drag/right-click to cancel (src/systems/skills.ts) ----
  /** skill key currently held (keyboard 1/2/F/L, touch skill buttons, simulated) and since when (performance.now). */
  skillHeld: Record<SkillKey, boolean> = { spell1: false, spell2: false, special: false }; skillSince: Record<SkillKey, number> = { spell1: 0, spell2: 0, special: 0 };
  /** touch drag aim per skill (null = not dragging). */
  skillDrag: Record<SkillKey, { mode: 'auto' | 'aim' | 'cancel'; angle: number } | null> = { spell1: null, spell2: null, special: null };
  private kbSkill: Record<SkillKey, boolean> = { spell1: false, spell2: false, special: false };
  private touchSkill: Record<SkillKey, { id: number; x: number; y: number } | null> = { spell1: null, spell2: null, special: null };
  private simSkill: Record<SkillKey, boolean> = { spell1: false, spell2: false, special: false };
  private skillCancelled: Record<SkillKey, boolean> = { spell1: false, spell2: false, special: false };
  private skillDowns = new Set<SkillKey>(); private skillUps = new Map<SkillKey, 'cast' | 'cancel'>();
  skillButtons: Partial<Record<SkillKey, { c: Phaser.GameObjects.Container; img: Phaser.GameObjects.Image; r: number }>> = {};
  /** Attack press latch (performance.now of the last press edge). Survives hit-stop frames; read with takeAttackPress(). */
  private atkPress = 0; private prevAttack = false;
  constructor(public scene: Phaser.Scene, public opts: { touchButtons?: boolean } = {}) {
    const kb = scene.input.keyboard!;
    this.keys = kb.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,SHIFT,F,E,R,Q,TAB,I,ONE,TWO,M,ESC,K,J,L,P') as any;
    kb.addCapture('TAB,SPACE,UP,DOWN,LEFT,RIGHT');
    const map: Array<[string, Act]> = [['SPACE', 'dash'], ['SHIFT', 'dash'], ['R', 'potion'], ['TAB', 'inventory'], ['I', 'inventory'], ['E', 'interact'], ['ESC', 'pause'], ['P', 'pause'], ['M', 'map'], ['Q', 'reload']];
    for (const [k, a] of map) this.keys[k].on('down', () => { this.pressed.add(a); unlockAudio(); });
    const skillKeys: Array<[string, SkillKey]> = [['ONE', 'spell1'], ['TWO', 'spell2'], ['F', 'special'], ['L', 'special']];
    for (const [k, sk] of skillKeys) {
      this.keys[k].on('down', () => { unlockAudio(); if (!this.kbSkill[sk]) { this.kbSkill[sk] = true; this.skillPress(sk); } });
      this.keys[k].on('up', () => { if (this.kbSkill[sk] && !(sk === 'special' && (this.keys.F.isDown || this.keys.L.isDown))) { this.kbSkill[sk] = false; this.skillRelease(sk); } });
    }
    this.keys.J.on('down', () => this.latchAttack());
    scene.input.mouse?.disableContextMenu();
    scene.input.on('pointerdown', (p: Phaser.Input.Pointer, over: any[]) => {
      unlockAudio();
      if (over && over.length) return;
      if (this.touch && p.wasTouch) { if (p.x < 640 && !this.joy) this.joy = { id: p.id, bx: p.x, by: p.y, dx: 0, dy: 0 }; return; }
      if (p.rightButtonDown()) { if (!this.cancelHeldSkills()) this.mouseGuard = true; } else { this.mouseAttack = true; this.latchAttack(); }
    });
    scene.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      if (this.joy && this.joy.id === p.id) { this.joy = null; }
      for (const k of SKILL_KEYS) { const ts = this.touchSkill[k]; if (ts && ts.id === p.id) { this.touchSkill[k] = null; if (this.skillDrag[k]?.mode === 'cancel') this.skillCancelled[k] = true; this.skillRelease(k); } }
      if (!p.leftButtonDown()) this.mouseAttack = false; if (!p.rightButtonDown()) this.mouseGuard = false;
    });
    scene.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      for (const k of SKILL_KEYS) { const ts = this.touchSkill[k]; if (ts && ts.id === p.id) this.skillDrag[k] = aimFromDrag(p.x - ts.x, p.y - ts.y); }
      if (this.joy && this.joy.id === p.id) { this.joy.dx = p.x - this.joy.bx; this.joy.dy = p.y - this.joy.by; }
      else if (!p.wasTouch) this.lastMouse = performance.now();
    });
    if (this.touch && opts.touchButtons !== false) this.buildTouch();
  }
  private buildTouch() {
    const s = this.scene; const c = s.add.container(0, 0).setScrollFactor(0).setDepth(9000); this.touchUi = c;
    this.joyG = s.add.graphics().setScrollFactor(0).setDepth(9000);
    const mk = (x: number, y: number, r: number, icon: string, label: string, down: (p: Phaser.Input.Pointer) => void, up?: () => void) => {
      const b = s.add.container(x, y); const g = s.add.graphics();
      g.fillStyle(PAL.orangeLip, 1).fillCircle(0, 4, r); g.fillStyle(PAL.orange, 1).fillCircle(0, 0, r); g.fillStyle(PAL.orangeHi, 0.8).fillCircle(-r * 0.25, -r * 0.3, r * 0.3); g.lineStyle(3, PAL.outline, 1).strokeCircle(0, 0, r);
      b.add(g); const ir = iconRef(s, icon); b.add(s.add.image(0, -4, ir.tex, ir.frame).setDisplaySize(r * 1.1, r * 1.1)); b.add(txt(s, 0, r * 0.55, label, 12).setOrigin(0.5));
      b.setSize(r * 2, r * 2).setInteractive(new Phaser.Geom.Circle(r, r, r), Phaser.Geom.Circle.Contains);
      b.on('pointerdown', (p: Phaser.Input.Pointer) => { unlockAudio(); down(p); }); b.on('pointerup', () => up?.()); b.on('pointerout', () => up?.());
      c.add(b); return b;
    };
    mk(1170, 600, 58, 'btn_attack', 'Đánh', () => { this.touchHeld.attack = true; this.latchAttack(); }, () => (this.touchHeld.attack = false));
    mk(1050, 650, 42, 'btn_dash', 'Lướt', () => this.pressed.add('dash'));
    // skill buttons: hold = aim preview (+ name tooltip after a long press), drag = aim, drag beyond the ring = cancel, release = cast
    const skillBtn = (k: SkillKey, x: number, y: number, r: number, icon: string, label: string) => {
      const b = mk(x, y, r, icon, label, (p) => {
        this.touchSkill[k] = { id: p.id, x, y }; this.skillDrag[k] = { mode: 'auto', angle: 0 }; this.skillPress(k);
      });
      this.skillButtons[k] = { c: b, img: b.list[1] as Phaser.GameObjects.Image, r };
    };
    skillBtn('special', 1065, 530, 40, 'btn_special', 'Kỹ năng');
    skillBtn('spell1', 965, 495, 30, 'btn_special', 'Phép 1');
    skillBtn('spell2', 1030, 440, 30, 'btn_special', 'Phép 2');
    mk(1190, 470, 34, 'btn_potion', 'Bình', () => this.pressed.add('potion'));
    mk(960, 670, 34, 'btn_bag', 'Túi', () => this.pressed.add('inventory'));
    mk(960, 580, 32, 'wpn_shield', 'Đỡ', () => (this.touchHeld.guard = true), () => (this.touchHeld.guard = false));
    mk(1110, 410, 30, 'btn_map', 'Dùng', () => this.pressed.add('interact'));
  }
  // ---- skills ----
  private skillPress(k: SkillKey) { this.skillCancelled[k] = false; this.skillDowns.add(k); this.skillSince[k] = performance.now(); }
  private skillRelease(k: SkillKey) { this.skillUps.set(k, this.skillCancelled[k] ? 'cancel' : 'cast'); this.skillCancelled[k] = false; this.skillDrag[k] = null; }
  /** Right click while a skill is held cancels it (and does not raise the guard). */
  private cancelHeldSkills(): boolean { let any = false; for (const k of SKILL_KEYS) if (this.skillHeld[k] || this.kbSkill[k]) { this.skillCancelled[k] = true; any = true; } return any; }
  /** True once per press edge of a skill (charge-type specials start charging on it). */
  takeSkillDown(k: SkillKey): boolean { const v = this.skillDowns.has(k); this.skillDowns.delete(k); return v; }
  /** 'cast' / 'cancel' once per release of a skill, else null. */
  takeSkillUp(k: SkillKey): 'cast' | 'cancel' | null { const v = this.skillUps.get(k) ?? null; this.skillUps.delete(k); return v; }
  /** Is the held skill currently in the cancel zone (touch drag beyond the ring, or right-clicked)? */
  skillWillCancel(k: SkillKey): boolean { return this.skillCancelled[k] || this.skillDrag[k]?.mode === 'cancel'; }
  /** Swap a touch skill button's icon (spell artifact / weapon icon). */
  setSkillIcon(k: SkillKey, texKey: string, frame?: string | number) { const b = this.skillButtons[k]; if (b) b.img.setTexture(texKey, frame).setDisplaySize(b.r * 1.1, b.r * 1.1); }
  setTouchVisible(v: boolean) { this.touchUi?.setVisible(v); }
  consume(a: Act): boolean { if (SIM.queue.includes(a)) { SIM.queue.splice(SIM.queue.indexOf(a), 1); return true; } if (this.pressed.has(a)) { this.pressed.delete(a); return true; } return false; }
  clearPressed() { this.pressed.clear(); this.atkPress = 0; this.skillDowns.clear(); this.skillUps.clear(); for (const k of SKILL_KEYS) { this.kbSkill[k] = false; this.touchSkill[k] = null; this.skillDrag[k] = null; this.skillHeld[k] = false; } }
  private latchAttack() { this.atkPress = performance.now(); }
  /** True once per attack press (mouse, J, touch button or simulated edge) if it happened within the last `maxAgeMs`. */
  takeAttackPress(maxAgeMs = 1000): boolean { const ok = this.atkPress > 0 && performance.now() - this.atkPress <= maxAgeMs; this.atkPress = 0; return ok; }
  /** Call every frame with player's screen position for mouse aiming. */
  update(px: number, py: number) {
    const k = this.keys; let x = 0, y = 0;
    if (k.A.isDown || k.LEFT.isDown) x -= 1; if (k.D.isDown || k.RIGHT.isDown) x += 1; if (k.W.isDown || k.UP.isDown) y -= 1; if (k.S.isDown || k.DOWN.isDown) y += 1;
    if (this.joy) { const d = Math.hypot(this.joy.dx, this.joy.dy); if (d > 8) { const m = Math.min(1, d / 60); x = this.joy.dx / d * m; y = this.joy.dy / d * m; } }
    const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; }
    this.moveX = x; this.moveY = y;
    this.attack = this.mouseAttack || this.touchHeld.attack || k.J.isDown;
    void this.touchHeld.special;
    this.guard = this.mouseGuard || this.touchHeld.guard || k.K.isDown;
    const p = this.scene.input.activePointer;
    if (!this.touch && performance.now() - this.lastMouse < 4000) { this.aim = Math.atan2(p.worldY - py, p.worldX - px); this.aimSet = true; }
    else if (l > 0.1) { this.aim = Math.atan2(y, x); this.aimSet = false; }
    else this.aimSet = false;
    const sim = SIM.cur;
    if (sim) {
      if (performance.now() > sim.until) SIM.cur = null;
      else {
        if (sim.move) { this.moveX = sim.move[0]; this.moveY = sim.move[1]; }
        if (sim.aim !== undefined) { this.aim = sim.aim; this.aimSet = true; }
        if (sim.attack) this.attack = true; if (sim.guard) this.guard = true;
      }
    }
    // skills: held = keyboard || touch || simulated (simulated edges produce press / release like real keys)
    for (const sk of SKILL_KEYS) {
      const simNow = !!(SIM.cur && (sk === 'special' ? SIM.cur.special : SIM.cur[sk]));
      if (simNow && !this.simSkill[sk]) this.skillPress(sk);
      if (!simNow && this.simSkill[sk]) this.skillRelease(sk);
      this.simSkill[sk] = simNow;
      if (simNow && SIM.cur?.drag?.key === sk) this.skillDrag[sk] = aimFromDrag(SIM.cur.drag.dx, SIM.cur.drag.dy);
      this.skillHeld[sk] = this.kbSkill[sk] || !!this.touchSkill[sk] || simNow;
    }
    this.special = this.skillHeld.special;
    if (this.attack && !this.prevAttack && !this.atkPress) this.latchAttack();
    this.prevAttack = this.attack;
    if (this.joyG) {
      this.joyG.clear();
      if (this.joy) { this.joyG.fillStyle(0x000000, 0.18).fillCircle(this.joy.bx, this.joy.by, 60).lineStyle(3, PAL.outline, 0.7).strokeCircle(this.joy.bx, this.joy.by, 60); const d = Math.min(60, Math.hypot(this.joy.dx, this.joy.dy)); const a = Math.atan2(this.joy.dy, this.joy.dx); this.joyG.fillStyle(PAL.cream, 0.9).fillCircle(this.joy.bx + Math.cos(a) * d, this.joy.by + Math.sin(a) * d, 26).lineStyle(3, PAL.outline, 1).strokeCircle(this.joy.bx + Math.cos(a) * d, this.joy.by + Math.sin(a) * d, 26); }
    }
  }
  destroy() { this.touchUi?.destroy(); this.joyG?.destroy(); }
}
