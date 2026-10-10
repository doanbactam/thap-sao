// Asset manifest loader + procedural placeholders. Art can be hot-swapped by editing the manifests only.
import Phaser from 'phaser';

export interface AnimDef { frames: Array<number | string>; fps?: number; loop?: boolean }
export interface ManifestEntry {
  type: 'image' | 'sheet' | 'atlas'; file: string; atlas?: string; frameW?: number; frameH?: number;
  anims?: Record<string, AnimDef>; anchor?: [number, number]; scale?: number; facing?: 'left' | 'right'; hitRadius?: number; nine?: [number, number, number, number];
}
export const MANIFEST: Record<string, ManifestEntry> = {};
const W = window as any;
/** Single-file build embeds files as data URIs / JSON objects. */
const EMB: Record<string, string> = W.__TS_ASSETS__ ?? {};
const EMBJ: Record<string, any> = W.__TS_JSON__ ?? {};
export const assetUrl = (rel: string) => EMB[rel] ?? `assets/${rel}`;

export const PAL = {
  outline: 0x3b2416, cream: 0xfff4dc, creamLo: 0xf1deb5, creamLip: 0xcdb083, orange: 0xf4a63b, orangeHi: 0xffcb6b, orangeLo: 0xd97b28, orangeLip: 0xa9531e,
  green: 0x7cc44e, greenHi: 0xa6e070, greenLo: 0x5fa63a, greenLip: 0x3f7a25, red: 0xe2483d, redHi: 0xff7a66, redLo: 0xc2352d, redLip: 0x8e2420,
  wood: 0xc98a4b, woodHi: 0xe2a866, woodLo: 0xa86b35, woodLip: 0x7a4a24, purple: 0x8e6cd8, purpleHi: 0xb69bf0, purpleLo: 0x7353c0, purpleLip: 0x4e3592,
  pill: 0x4a3426, track: 0x3a2a20, fill: 0x8bd14e, fillHi: 0xb5ec7a, hp: 0xe2483d, mp: 0x4fa3e0, xp: 0xf4c23b, teal: 0x2fa4a8, grass: 0x98b466, dirt: 0xcfa251, water: 0x71c2d9,
  text2: 0x7a4a24, accent: 0xa9531e, positive: 0x3f7a25,
};
export const RARITY_COLOR: Record<string, number> = { common: 0x9aa39a, rare: 0x4fa3e0, epic: 0x9a6ad8, legendary: 0xf4a63b };
/** readable rarity text colours on cream cards */
export const RARITY_TEXT: Record<string, string> = { common: '#5F675F', rare: '#2B76B8', epic: '#7445BC', legendary: '#C26A12' };
export const FONT = '"Baloo 2", "Baloo2", Nunito, Arial, sans-serif';

/** Phase 1 (Boot): load manifests.json then each listed manifest. */
export function queueManifests(scene: Phaser.Scene) {
  if (EMBJ['manifests.json']) { scene.cache.json.add('manifests', EMBJ['manifests.json']); return; }
  scene.load.json('manifests', 'assets/manifests.json');
}
export function queueManifestParts(scene: Phaser.Scene): string[] {
  const list: string[] = scene.cache.json.get('manifests') ?? [];
  const keys: string[] = [];
  for (const f of Array.isArray(list) ? list : []) {
    const k = `mf:${f}`; keys.push(k);
    if (EMBJ[f]) scene.cache.json.add(k, EMBJ[f]); else scene.load.json(k, `assets/${f}`);
  }
  return keys;
}
/** Phase 2: merge manifests. */
export function mergeManifests(scene: Phaser.Scene, partKeys: string[]) {
  for (const k of partKeys) {
    const m = scene.cache.json.get(k); if (!m || typeof m !== 'object') continue;
    for (const [key, e] of Object.entries<any>(m)) if (e && e.file && e.type) MANIFEST[key] = e;
  }
}
/** Chapter-scoped art (lazy loaded / unloaded to save GPU memory). */
export const isChapterKey = (k: string) => /^(en_|mb_|boss_|ts_ch\d|prop_ch\d)/.test(k);
export function queueKeys(scene: Phaser.Scene, keys: string[]): number {
  let n = 0;
  for (const key of keys) {
    const e = MANIFEST[key]; if (!e || scene.textures.exists(key)) continue;
    try {
      if (e.type === 'image') scene.load.image(key, assetUrl(e.file));
      else if (e.type === 'sheet') scene.load.spritesheet(key, assetUrl(e.file), { frameWidth: e.frameW ?? 96, frameHeight: e.frameH ?? 96 });
      else if (e.type === 'atlas' && e.atlas) scene.load.atlas(key, assetUrl(e.file), EMBJ[e.atlas] ?? assetUrl(e.atlas));
      n++;
    } catch (err) { console.warn('asset queue failed', key, err); }
  }
  return n;
}
export function bootKeys(): string[] { return Object.keys(MANIFEST).filter((k) => !isChapterKey(k)); }
export function chapterKeys(ch: number, enemySprites: string[], bossSprites: string[]): string[] {
  const out = new Set<string>([`ts_ch${ch}`, ...enemySprites, ...bossSprites]);
  for (const k of Object.keys(MANIFEST)) if (k.startsWith(`prop_ch${ch}_`)) out.add(k);
  return [...out].filter((k) => MANIFEST[k]);
}
export const loadedChapter: { ch: number; keys: string[] } = { ch: 0, keys: [] };
/** Ensure chapter art is loaded (unloading the previous chapter's textures). Calls done() when ready. */
export function ensureChapter(scene: Phaser.Scene, ch: number, keys: string[], done: () => void) {
  if (loadedChapter.ch !== ch) {
    for (const k of loadedChapter.keys) if (!keys.includes(k)) unloadKey(scene, k);
    loadedChapter.ch = ch; loadedChapter.keys = keys;
  }
  const n = queueKeys(scene, keys);
  if (!n) { done(); return; }
  scene.load.once('complete', () => { buildAnims(scene); done(); });
  scene.load.start();
}
export function unloadKey(scene: Phaser.Scene, key: string) {
  if (!scene.textures.exists(key) || placeholders.has(key)) return;
  const e = MANIFEST[key]; for (const n of Object.keys(e?.anims ?? {})) scene.anims.remove(`${key}:${n}`);
  scene.textures.remove(key);
}
/** frame-name → atlas key index so icon keys can live inside any atlas */
const frameIndex = new Map<string, { tex: string; frame: string }>();
export function buildAnims(scene: Phaser.Scene) {
  for (const [key, e] of Object.entries(MANIFEST)) {
    if (!scene.textures.exists(key)) continue;
    if (e.type === 'atlas') for (const fname of scene.textures.get(key).getFrameNames()) frameIndex.set(fname, { tex: key, frame: fname });
    for (const [name, a] of Object.entries(e.anims ?? {})) {
      const id = `${key}:${name}`; if (scene.anims.exists(id) || !a.frames?.length) continue;
      const total = scene.textures.get(key).frameTotal - 1;
      const frames = a.frames.filter((f) => typeof f !== 'number' || f < total).map((f) => ({ key, frame: f as any }));
      if (!frames.length) continue;
      scene.anims.create({ key: id, frames, frameRate: a.fps ?? 8, repeat: a.loop === false ? 0 : (a.loop ? -1 : (['idle', 'run'].includes(name) ? -1 : 0)) });
    }
  }
}
export function iconRef(scene: Phaser.Scene, key: string, kind: PlaceholderKind = 'icon'): { tex: string; frame?: string } {
  if (scene.textures.exists(key)) return { tex: key };
  const f = frameIndex.get(key); if (f) return { tex: f.tex, frame: f.frame };
  ensureTex(scene, key, kind); return { tex: key };
}
export const entry = (key: string) => MANIFEST[key];
/** Mirror a sprite horizontally around its origin (tight-cropped art keeps feet in place). */
export function face(s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, key: string, left: boolean) {
  const nat = MANIFEST[key]?.facing === 'left'; const flip = nat ? !left : left;
  const ax = Math.abs(s.scaleX); s.scaleX = flip ? -ax : ax;
}
export const hasAnim = (scene: Phaser.Scene, key: string, anim: string) => scene.anims.exists(`${key}:${anim}`);
export function playAnim(s: Phaser.GameObjects.Sprite, key: string, anim: string, ignoreIfPlaying = true) {
  const id = `${key}:${anim}`;
  if (s.scene.anims.exists(id)) s.play(id, ignoreIfPlaying);
}
/** Apply manifest anchor/scale; `px` = desired on-screen height when no manifest scale is present. */
export function applyEntry(s: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image, key: string, px?: number, defAnchor: [number, number] = [0.5, 0.9]) {
  const e = MANIFEST[key];
  const a = e?.anchor ?? defAnchor; s.setOrigin(a[0], a[1]);
  if (e?.scale) s.setScale(e.scale);
  else if (px) { const h = s.height || 1; s.setScale(px / h); }
  return s;
}

/** Bake a grid of 48-px tiles (stored 96 px) into one RenderTexture: one draw call and no decal overdraw per frame. */
export function bakeTiles(scene: Phaser.Scene, texKey: string, cells: Array<[number, number, number]>, w = 1296, h = 720, depth = -10) {
  const src = scene.textures.get(texKey).getSourceImage() as any; const fw = (MANIFEST[texKey]?.frameW ?? 96);
  const sc = 48 / (fw || 96);
  try {
    const rt = scene.add.renderTexture(0, 0, w, h).setOrigin(0, 0).setDepth(depth);
    for (const [c, r, f] of cells) rt.stamp(texKey, f, c * 48, r * 48, { originX: 0, originY: 0, scale: sc });
    (rt as any).render?.();
    void src; return rt as Phaser.GameObjects.GameObject;
  } catch (err) {
    console.warn('bakeTiles fallback', err);
    const c = scene.add.container(0, 0).setDepth(depth);
    for (const [cc, r, f] of cells) c.add(scene.add.image(cc * 48, r * 48, texKey, f).setOrigin(0, 0).setDisplaySize(48, 48));
    return c as Phaser.GameObjects.GameObject;
  }
}

// ---------------- placeholders ----------------
export type PlaceholderKind = 'char' | 'enemy' | 'boss' | 'npc' | 'prop' | 'icon' | 'fx' | 'proj' | 'tile' | 'ui' | 'weapon';
const hash = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
export const placeholders = new Set<string>();
export function guessKind(key: string): PlaceholderKind {
  if (key.startsWith('hero_')) return 'char'; if (key.startsWith('en_')) return 'enemy'; if (key.startsWith('mb_') || key.startsWith('boss_')) return 'boss';
  if (key.startsWith('npc_') || key.startsWith('cmp_')) return 'npc'; if (key.startsWith('ts_')) return 'tile'; if (key.startsWith('fx_')) return 'fx';
  if (key.startsWith('pj_')) return 'proj'; if (key.startsWith('ui_')) return 'ui'; if (key.startsWith('wpn_')) return 'weapon';
  if (/^(art_|tab_|ic_|node_|mod_|combo_|st_|btn_|pot_|mir_|wic_)/.test(key)) return 'icon';
  return 'prop';
}
export function ensureTex(scene: Phaser.Scene, key: string, kind: PlaceholderKind = guessKind(key)): string {
  if (scene.textures.exists(key)) return key;
  const h = hash(key); const hue = (h % 360) / 360;
  const col = Phaser.Display.Color.HSLToColor(hue, 0.45, 0.62).color, dark = Phaser.Display.Color.HSLToColor(hue, 0.45, 0.42).color;
  const css = (c: number) => '#' + c.toString(16).padStart(6, '0');
  const size: Record<PlaceholderKind, [number, number]> = { char: [64, 72], enemy: [72, 72], boss: [220, 220], npc: [64, 72], prop: [96, 96], icon: [96, 96], fx: [96, 96], proj: [32, 32], tile: [96, 96], ui: [64, 64], weapon: [64, 20] };
  let [w, hgt] = size[kind];
  if (key.startsWith('mb_')) { w = 150; hgt = 150; }
  if (kind === 'tile') {
    // 32 frames (8x4) of 96px; floor variants first
    const tex = scene.textures.createCanvas(key, 96 * 8, 96 * 4)!; const c = tex.getContext();
    for (let i = 0; i < 32; i++) {
      const x = (i % 8) * 96, y = Math.floor(i / 8) * 96;
      const base = i < 16 ? col : dark; c.fillStyle = css(base); c.fillRect(x, y, 96, 96);
      c.fillStyle = 'rgba(255,255,255,0.08)'; if ((i * 7) % 3 === 0) c.fillRect(x + 10 + (i * 13) % 50, y + 12 + (i * 17) % 50, 18, 10);
      c.fillStyle = 'rgba(59,36,22,0.18)'; c.fillRect(x, y + 94, 96, 2); c.fillRect(x + 94, y, 2, 96);
      tex.add(i, 0, x, y, 96, 96);
    }
    tex.refresh(); placeholders.add(key); return key;
  }
  const tex = scene.textures.createCanvas(key, w, hgt)!; const c = tex.getContext();
  c.lineWidth = Math.max(2, w / 24); c.strokeStyle = css(PAL.outline); c.fillStyle = css(col);
  const rr = (x: number, y: number, ww: number, hh: number, r: number) => { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + ww, y, x + ww, y + hh, r); c.arcTo(x + ww, y + hh, x, y + hh, r); c.arcTo(x, y + hh, x, y, r); c.arcTo(x, y, x + ww, y, r); c.closePath(); };
  switch (kind) {
    case 'char': case 'npc': case 'enemy': case 'boss': {
      c.fillStyle = 'rgba(40,24,12,0.25)'; c.beginPath(); c.ellipse(w / 2, hgt * 0.9, w * 0.34, hgt * 0.07, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = css(key.startsWith('hero') ? 0xf1deb5 : col);
      c.beginPath(); c.ellipse(w / 2, hgt * 0.55, w * 0.38, hgt * 0.34, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      if (key.startsWith('hero')) { c.fillStyle = css(PAL.teal); c.fillRect(w * 0.25, hgt * 0.62, w * 0.5, hgt * 0.08); c.strokeRect(w * 0.25, hgt * 0.62, w * 0.5, hgt * 0.08); c.fillStyle = css(0x98b466); c.beginPath(); c.ellipse(w / 2, hgt * 0.22, w * 0.22, hgt * 0.08, 0, 0, Math.PI * 2); c.fill(); c.stroke(); }
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w * 0.62, hgt * 0.48, w * 0.08, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = css(PAL.outline); c.beginPath(); c.arc(w * 0.65, hgt * 0.48, w * 0.035, 0, Math.PI * 2); c.fill();
      break;
    }
    case 'icon': { rr(6, 6, w - 12, hgt - 12, 18); c.fill(); c.stroke(); c.fillStyle = css(dark); c.beginPath(); c.arc(w / 2, hgt / 2, w * 0.2, 0, Math.PI * 2); c.fill(); break; }
    case 'proj': { c.beginPath(); c.arc(w / 2, hgt / 2, w * 0.38, 0, Math.PI * 2); c.fillStyle = key.includes('enemy') || key.includes('star') ? '#e2483d' : '#ffe08a'; c.fill(); c.stroke(); break; }
    case 'fx': { c.globalAlpha = 0.85; c.beginPath(); c.arc(w / 2, hgt / 2, w * 0.42, 0, Math.PI * 2); c.fillStyle = css(col); c.fill(); break; }
    case 'weapon': { c.fillStyle = '#d9dde3'; rr(2, hgt * 0.3, w - 4, hgt * 0.4, 4); c.fill(); c.stroke(); c.fillStyle = css(PAL.woodLo); c.fillRect(0, hgt * 0.2, w * 0.25, hgt * 0.6); break; }
    case 'ui': { rr(3, 3, w - 6, hgt - 6, 14); c.fill(); c.stroke(); break; }
    default: { rr(8, hgt * 0.25, w - 16, hgt * 0.68, 14); c.fill(); c.stroke(); c.fillStyle = css(dark); rr(14, hgt * 0.62, w - 28, hgt * 0.24, 8); c.fill(); }
  }
  if (kind !== 'proj' && kind !== 'fx' && kind !== 'weapon' && w >= 64) {
    c.font = `800 ${Math.max(10, Math.round(w / 9))}px Arial`; c.textAlign = 'center'; c.fillStyle = '#fff'; c.strokeStyle = css(PAL.outline); c.lineWidth = 3;
    const label = key.replace(/^(en_|mb_|boss_|hero_|npc_|prop_|hub_|art_|tab_|node_|ic_)/, '').slice(0, 12);
    c.strokeText(label, w / 2, hgt - 6); c.fillText(label, w / 2, hgt - 6);
  }
  tex.refresh(); placeholders.add(key);
  return key;
}
/** Make sure a key renders (real art or placeholder) and return {tex, frame}. */
export function tex(scene: Phaser.Scene, key: string, kind?: PlaceholderKind) { return iconRef(scene, key, kind ?? guessKind(key)); }
