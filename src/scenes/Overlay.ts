// Base for modal overlay scenes: pauses the caller, resumes it on close.
import Phaser from 'phaser';
import { G } from '../game/state';
import { dim, card, button, title } from '../ui/kit';
import { t } from '../systems/i18n';

export interface OverlayData { from?: string; onClose?: (result?: any) => void; [k: string]: any }
export function openOverlay(from: Phaser.Scene, key: string, data: OverlayData = {}) {
  G.logEvent('overlay', { key });
  if (from.scene.isActive(from.scene.key)) from.scene.pause();
  if (from.scene.isActive('Hud')) from.scene.get('Hud').input.enabled = false;
  from.scene.launch(key, { ...data, from: from.scene.key });
  from.scene.bringToTop(key);
}
export class Overlay extends Phaser.Scene {
  data0: OverlayData = {};
  init(d: OverlayData) { this.data0 = d ?? {}; }
  close(result?: any) {
    const from = this.data0.from; const cb = this.data0.onClose;
    this.scene.stop();
    if (from) { const s = this.scene.get(from); if (s && this.scene.isPaused(from)) this.scene.resume(from); }
    if (this.scene.isActive('Hud')) this.scene.get('Hud').input.enabled = true;
    G.logEvent('overlayClosed', { key: this.scene.key });
    cb?.(result);
  }
  frame(heading: string, w = 1180, h = 640, closeLabel = t('menu.close')) {
    dim(this); card(this, 640, 370, w, h); title(this, heading, 370 - h / 2 + 4);
    if (closeLabel) button(this, 640 + w / 2 - 80, 370 - h / 2 + 4, 130, 50, closeLabel, () => this.close(), 'red', { id: 'close' });
  }
}
