// Boot: manifests → merge → load boot-scoped art (hub/hero/UI/fx; chapter art is lazy) → fonts → Hub.
import Phaser from 'phaser';
import { queueManifests, queueManifestParts, mergeManifests, queueKeys, bootKeys, buildAnims, PAL, FONT } from '../game/assets';
import { G } from '../game/state';

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
        const go = () => { G.logEvent('boot', {}); this.scene.start('Hub'); };
        if (fonts?.load) Promise.race([Promise.all([fonts.load('800 24px "Baloo 2"'), fonts.load('700 18px "Baloo 2"')]), new Promise((r) => setTimeout(r, 2500))]).then(go, go); else go();
      });
      this.load.start();
    });
    this.parts = queueManifestParts(this);
    this.load.start();
  }
}
