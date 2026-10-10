import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  server: { host: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 4000, assetsInlineLimit: 0 },
  test: { include: ['tests/**/*.test.ts', 'src/**/*.test.ts'], environment: 'node' },
} as any);
