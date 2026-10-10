# V2 — Performance (mid-range Android, browser / WebView)

## Measurement
`node tools/perf.mjs <distDir> <label> [seconds]` — headless Chromium (swiftshader), `?debug=1`, heavy combat room:
start room of a fresh run (seed 4242), **30 chapter-1 enemies** (chaser / ring / charger / shooter, HP 1e9 so none
die), god mode, crossbow auto-firing, plus a load generator every 100 ms: an 8-bullet ring from a random enemy while
fewer than 110 projectiles exist and 3 hits with damage numbers + hit FX. Warm-up 6 s, then measured for N s:

- `step_ms` — wall time from Phaser `prestep` to `postrender` (update + render submission = main-thread cost per frame)
- `runUpdate_ms` — `RunScene.update` alone
- `scriptMsPerFrame` / `taskMsPerFrame` — CDP `Performance.getMetrics` ScriptDuration / TaskDuration per frame
- `objectsCreatedPerSec` — `addedtoscene` events in RunScene (game objects created)
- `shaderLinks` / `shaderPrograms` — WebGL programs linked during the window / cached in total
- `fps` — rAF frame rate (dominated by software rasterisation here; a real phone GPU is far faster)

Results append to `out/perf/results.jsonl`; `PROFILE=1` also writes a `.cpuprofile` (`node tools/profsum.mjs <file>`).

### Before / after (isolated)
To keep the three other agents' concurrent changes out of the comparison, the baseline is `git archive 7458848`
(v1) and "after" is the same v1 tree with **only this workstream's changes** applied (`work/perf_base`,
`work/perf_mine`). Runs were interleaved; the sandbox (2 cores) was shared with other agents' test runs
(load avg 4.5–7), so the median of 3 is reported.

| metric (median of 3) | v1 baseline | v2 (this workstream) | change |
|---|---|---|---|
| main-thread step per frame (avg) | 14.1 ms | 9.7 ms | **−31 %** |
| step p95 | 31.7 ms | 17.6 ms | **−44 %** |
| script time per frame (CDP) | 21.5 ms | 10.8 ms | **−50 %** |
| task time per frame (CDP) | 26.1 ms | 15.0 ms | −43 % |
| game objects created / s | ~70 | ~2 | **−97 %** |
| fps (swiftshader) | 6.4 | 14.3 | ×2.2 |
| RunScene.update | 1.1 ms | 1.1 ms | — (logic unchanged) |

CPU profile (8 s, same scenario): v1 spends 140 ms in `getProgramParameter` (shader programs linked mid-fight as new
texture/text combinations appear), 87 ms in `GraphicsWebGLRenderer` (30 per-enemy HP-bar Graphics re-tessellated
every frame, incl. `isEar` earcut), 161 ms GC, 24 ms `texImage2D` (one canvas texture per damage number). v2:
no runtime shader links, Graphics 35 ms (HUD + hazards), GC 60 ms, no per-hit texture uploads.

Full working tree (all four workstreams, same scenario, load 4.0): step 12.3 ms, script 13.9 ms/frame, 11.2 fps,
34 objects created/s — the remaining creations are other workstreams' new per-hit effects (they can use the pools below).

## What changed
1. **Pools** (`src/game/fxPool.ts`), one `UPDATE` listener per scene animates everything (no tweens, no closures per hit):
   - `fxAt(scene, key, x, y, size)` — FX sprites recycled; **cap 56 live** (oldest recycled = particle cap).
     `RunScene.fxAt` delegates to it.
   - `acquireImage / releaseImage` — projectile images (enemy + player) recycled, pool cap 520.
   - `floatText(scene, …)` — damage numbers use a **bitmap font generated once at runtime from Baloo 2** (digits
     `+-%.!`, white fill + brown outline, tinted per colour) → no canvas/texture per number; words ("Né!", "Đỡ!")
     use pooled `Text`. **Cap 36 live**. `RunScene.floatText` delegates to it.
   - `EnemyBar` — HP bar as 2 image quads + status dots (pre-rendered rounded textures) instead of a `Graphics`
     with rounded rects re-recorded and re-tessellated every frame; no per-frame arrays.
2. **Hot-path allocations**: projectile list compacted in place (no `filter` per frame), enemy bullets share one empty
   hit-set (no `new Set()` per bullet), `spellCd` updated in place, HP-bar status list without array literals.
3. **HUD** (`HudScene`): bars, dash pips, potion belt and spell slots are redrawn only when their values change
   (change keys), instead of clearing and re-recording Graphics + text every frame.
4. **Renderer config** (`src/main.ts`): `antialiasGL: false` (no MSAA on the backbuffer — the art is pre-smoothed
   textures; MSAA only cost fill-rate on phones), `powerPreference: 'high-performance'`. The backbuffer stays a fixed
   1280×720 scaled by CSS (`Scale.FIT`), never multiplied by `devicePixelRatio` — the right trade-off for mid-range
   Android (a 1080p/1440p DPR-scaled canvas would 2–4× the fill cost for no visible gain with this art).

## Evaluated, not done
- **Packing loose images into atlases.** Phaser 4 batches up to the GPU's texture-unit count per draw, and the profile
  shows no texture-bind-bound cost in the combat scene (bindTexture ≈ 30 ms / 8 s). Repacking `pj_*` / `wpn_*` / `fx_*`
  into one atlas would change every key → frame lookup across scenes and the art agents' manifest contract for a small
  gain; `bakeTiles` already collapses the ~450 floor tiles into one texture. Loading is the only place loose files hurt
  (≈208 requests at boot): if WebView startup becomes an issue, pack at build time in `tools/build-single.mjs`.
- **Shader warm-up / `skipUnreadyShaders`.** v1 linked shader programs mid-fight (140 ms of `getProgramParameter` in
  8 s); the v2-only build linked none in the window, the full tree 1 (a one-off variant, ~200 ms under swiftshader;
  `tools/perf.mjs` reports `shaderLinks` + `shaderPrograms`). Phaser's `skipUnreadyShaders` was tried and reverted:
  in 4.2.1 a program never completes when `KHR_parallel_shader_compile` is missing (some Android WebViews), so those
  objects would never draw. A boot-time warm-up (draw one frame with 1..N distinct textures per tint mode) is the
  remaining option if real devices show a first-fight hitch.

## Rules for new code in the combat loop
Use `fxAt` / `floatText` / `acquireImage` from `src/game/fxPool.ts` instead of `add.sprite/add.text + tween + destroy`;
avoid `Graphics` that are cleared and redrawn every frame (use images, or redraw only on change); avoid `filter/map`
and object/array literals per entity per frame.
