// Shared headless browser helpers: static server for dist/, chromium discovery (playwright-core).
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
const here = path.dirname(fileURLToPath(import.meta.url));
export const root = path.resolve(here, '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf', '.css': 'text/css', '.jpg': 'image/jpeg', '.webp': 'image/webp' };
export function serve(dir, port = 0) {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      let p = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (p.endsWith('/')) p += 'index.html';
      const f = path.join(dir, p); if (!f.startsWith(dir) || !fs.existsSync(f)) { rsp.writeHead(404); rsp.end(); return; }
      rsp.writeHead(200, { 'content-type': MIME[path.extname(f)] ?? 'application/octet-stream' }); fs.createReadStream(f).pipe(rsp);
    });
    srv.listen(port, '127.0.0.1', () => res({ srv, url: `http://127.0.0.1:${srv.address().port}` }));
  });
}
export function findChrome() {
  const c = [process.env.CHROME_PATH, '/workspace/projects/ea42cd77-2984-436b-ba9e-18585dd39e97/work/pw/browsers/chromium-1140/chrome-linux/chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'];
  for (const p of c) if (p && fs.existsSync(p)) return p;
  return undefined; // let playwright try its own install
}
export async function launch() {
  const sys = path.join(root, 'tools/.sysroot/usr/lib/aarch64-linux-gnu');
  const env = { ...process.env }; if (fs.existsSync(sys)) env.LD_LIBRARY_PATH = [sys, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  return chromium.launch({ executablePath: findChrome(), env, args: ['--no-sandbox', '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
}
