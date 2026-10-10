// Boot: manifests → merge → load boot-scoped art (hub/hero/UI/fx; chapter art is lazy) → fonts → Hub.
import Phaser from 'phaser';
import { queueManifests, queueManifestParts, mergeManifests, queueKeys, bootKeys, buildAnims, PAL, FONT } from '../game/assets';
import { G } from '../game/state';
import { playMusic, stopMusic, musicEnabled, musicState } from '../game/audio';
import '../game/enemyAnim'; // registers window.__TSAnim (enemy wind-up / recovery poses for AI + tools)

export class BootScene extends Phaser.Scene {
  constructor() { super('Boot'); }
  parts: string[] = [];
  preload() {
    this.add.text(640, 360, 'Tháp Sao', { fontFamily: FONT, fontSize: '48px', color: '#fff4dc' }).setOrigin(0.5);
    queueManifests(this);
  }
  create() {
    this.load.once('complete', () => {
      mergeManifests(this, this.parts);
      const g = this.add.graphics();
      this.load.on('progress', (p: number) => { g.clear(); g.fillStyle(PAL.track, 1).fillRoundedRect(440, 420, 400, 22, 11).fillStyle(PAL.fill, 1).fillRoundedRect(442, 422, 396 * p, 18, 9).lineStyle(3, PAL.outline, 1).strokeRoundedRect(440, 420, 400, 22, 11); });
      this.load.on('loaderror', (f: any) => console.warn('asset missing (placeholder used):', f?.key));
      queueKeys(this, bootKeys());
      this.load.once('complete', () => {
        buildAnims(this);
        const fonts = (document as any).fonts;
        const go = () => { G.logEvent('boot', {}); installMusicDirector(this.game); this.scene.start('Hub'); };
        if (fonts?.load) Promise.race([Promise.all([fonts.load('800 24px "Baloo 2"'), fonts.load('700 18px "Baloo 2"')]), new Promise((r) => setTimeout(r, 2500))]).then(go, go); else go();
      });
      this.load.start();
    });
    this.parts = queueManifestParts(this);
    this.load.start();
  }
}

/** Ambient music follows the active area (hub = 0, run = chapter) — checked twice a second, never per frame. */
function installMusicDirector(game: Phaser.Game) {
  let acc = 0;
  game.events.on(Phaser.Core.Events.POST_STEP, (_t: number, d: number) => {
    acc += d; if (acc < 500) return; acc = 0;
    const sm = game.scene; const inRun = (sm.isActive('Run') || sm.isPaused('Run')) && G.run;
    const area = inRun ? Math.max(1, Math.min(6, G.run!.chapter)) : (sm.isActive('Hub') ? 0 : musicState().area);
    if (G.meta.settings.mute || !musicEnabled()) { if (musicState().playing) stopMusic(true); return; }
    if (area >= 0) playMusic(area);
  });
}
