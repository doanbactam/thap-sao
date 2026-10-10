import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { RunScene } from './scenes/RunScene';
import { HudScene } from './scenes/HudScene';
import { InventoryScene, ChoiceScene, ShopScene, EnchantScene, MapScene, PauseScene, EventScene } from './scenes/overlays';
import { DestinyScene, TalentsScene, CostumesScene, WeaponsScene, JournalScene, SettingsScene, PickerScene, ResultsScene, EndingScene } from './scenes/meta';
import { installDebug } from './game/debug';
import { G } from './game/state';

const game = new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: 1280, height: 720, backgroundColor: '#2a1b12',
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  input: { activePointers: 4 },
  render: { antialias: true, pixelArt: false },
  scene: [BootScene, HubScene, RunScene, HudScene, InventoryScene, ChoiceScene, ShopScene, EnchantScene, MapScene, PauseScene, EventScene, DestinyScene, TalentsScene, CostumesScene, WeaponsScene, JournalScene, SettingsScene, PickerScene, ResultsScene, EndingScene],
});
const debug = (import.meta as any).env?.DEV || /[?&]debug=1/.test(location.search);
if (debug) { G.debug = true; installDebug(game); }
(window as any).__game = debug ? game : undefined;
