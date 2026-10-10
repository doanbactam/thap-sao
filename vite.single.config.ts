// Single-file build → docs/ThapSao.html (all JS inlined; assets are embedded as data URIs by tools/inline-assets.mjs).
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
export default defineConfig({
  base: './',
  plugins: [viteSingleFile()],
  publicDir: false,
  define: { __SINGLE_FILE__: 'true' },
  build: { outDir: 'dist-single', emptyOutDir: true, chunkSizeWarningLimit: 8000, assetsInlineLimit: 100000000 },
});
