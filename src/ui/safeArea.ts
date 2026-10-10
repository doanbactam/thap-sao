// Android / iOS safe-area (display cutout, rounded corners, gesture bar) → logical-px insets for the HUD.
// Reads CSS env(safe-area-inset-*) through a hidden probe (index.html sets viewport-fit=cover), keeps only the part that
// reaches into the FIT canvas (toGameInsets) and notifies listeners when it changes (resize / orientation change).
// Debug override: ?safe=l,t,r,b (CSS px) simulates a cutout, e.g. ?safe=0,0,48,0 for a right-side notch.
import type Phaser from 'phaser';
import { toGameInsets, dpToGame, ZERO_INSETS, type Insets } from './hudLayout';

let cur: Insets = { ...ZERO_INSETS }; let cssH = 720; const subs = new Set<(i: Insets) => void>();
/** Current safe-area insets in logical px (0 almost always under Scale.FIT). */
export const safeInsets = (): Insets => cur;
/** Logical px for `dp` CSS px at the current canvas size (e.g. dpPx(48) = the 48 dp touch target). */
export const dpPx = (dp: number) => dpToGame(dp, cssH);
/** Subscribe to inset changes; returns the unsubscribe function. */
export function onSafeArea(cb: (i: Insets) => void): () => void { subs.add(cb); return () => subs.delete(cb); }

function readCss(probe: HTMLElement): Insets {
  const m = /[?&]safe=([\d.]+),([\d.]+),([\d.]+),([\d.]+)/.exec(location.search);
  if (m) return { l: +m[1], t: +m[2], r: +m[3], b: +m[4] };
  const cs = getComputedStyle(probe); const p = (v: string) => parseFloat(v) || 0;
  return { l: p(cs.paddingLeft), t: p(cs.paddingTop), r: p(cs.paddingRight), b: p(cs.paddingBottom) };
}
export function installSafeArea(game: Phaser.Game) {
  if (typeof document === 'undefined') return;
  const probe = document.createElement('div');
  probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.appendChild(probe);
  const update = () => {
    const c = game.canvas; if (!c) return; const r = c.getBoundingClientRect(); cssH = r.height || cssH;
    const ins = toGameInsets(readCss(probe), { left: r.left, top: r.top, width: r.width, height: r.height }, { w: window.innerWidth, h: window.innerHeight });
    if (ins.l !== cur.l || ins.t !== cur.t || ins.r !== cur.r || ins.b !== cur.b) { cur = ins; subs.forEach((f) => f(ins)); }
  };
  game.scale.on('resize', update); window.addEventListener('resize', () => setTimeout(update, 50)); window.addEventListener('orientationchange', () => setTimeout(update, 250));
  game.events.once('ready', update); setTimeout(update, 0);
  (window as any).__TSLayout = { insets: () => cur, dp: (n: number) => dpPx(n), cssHeight: () => cssH };
}
