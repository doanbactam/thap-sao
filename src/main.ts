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
  // v2 perf: no MSAA on the backbuffer (art is pre-smoothed textures; MSAA only cost fill-rate on phones),
  // (skipUnreadyShaders deliberately NOT used: without KHR_parallel_shader_compile — some Android WebViews — Phaser 4.2
  // never completes the program and the objects never draw); high-performance GPU hint, fixed 1280×720 backbuffer CSS-scaled by FIT (never multiplied by devicePixelRatio).
  render: { antialias: true, antialiasGL: false, pixelArt: false, powerPreference: 'high-performance', roundPixels: false },
  scene: [BootScene, HubScene, RunScene, HudScene, InventoryScene, ChoiceScene, ShopScene, EnchantScene, MapScene, PauseScene, EventScene, DestinyScene, TalentsScene, CostumesScene, WeaponsScene, JournalScene, SettingsScene, PickerScene, ResultsScene, EndingScene],
});
const debug = (import.meta as any).env?.DEV || /[?&]debug=1/.test(location.search);
if (debug) { G.debug = true; installDebug(game); }
(window as any).__game = debug ? game : undefined;
