// Runs the content tests (src/data/*.test.ts) independently of the engine's vite.config.ts include list.
import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
export default defineConfig({
  root: fileURLToPath(new URL('../..', import.meta.url)),
  test: { include: ['src/data/**/*.test.ts'], environment: 'node' },
} as any);
