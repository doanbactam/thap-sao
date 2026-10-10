// Single-file build: vite (vite-plugin-singlefile) → inline every manifest-referenced asset as data URIs → docs/ThapSao.html
import { execSync } from 'node:child_process'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
execSync('npx vite build -c vite.single.config.ts', { cwd: root, stdio: 'inherit' });
const A = path.join(root, 'public/assets');
const mime = (f) => (f.endsWith('.png') ? 'image/png' : f.endsWith('.webp') ? 'image/webp' : f.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream');
const assets = {}, json = {};
const list = JSON.parse(fs.readFileSync(path.join(A, 'manifests.json'), 'utf8')); json['manifests.json'] = list;
for (const m of list) {
  const p = path.join(A, m); if (!fs.existsSync(p)) continue;
  const man = JSON.parse(fs.readFileSync(p, 'utf8')); json[m] = man;
  for (const e of Object.values(man)) {
    if (!e || !e.file) continue;
    const f = path.join(A, e.file); if (fs.existsSync(f) && !assets[e.file]) assets[e.file] = `data:${mime(f)};base64,${fs.readFileSync(f).toString('base64')}`;
    if (e.atlas) { const j = path.join(A, e.atlas); if (fs.existsSync(j)) json[e.atlas] = JSON.parse(fs.readFileSync(j, 'utf8')); }
  }
}
let html = fs.readFileSync(path.join(root, 'dist-single/index.html'), 'utf8');
const font = fs.readFileSync(path.join(A, 'fonts/Baloo2.ttf')).toString('base64');
html = html.replace('url("assets/fonts/Baloo2.ttf")', `url(data:font/ttf;base64,${font})`);
const inject = `<script>window.__TS_ASSETS__=${JSON.stringify(assets)};window.__TS_JSON__=${JSON.stringify(json)};</script>`;
html = html.replace('<head>', '<head>' + inject);
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs/ThapSao.html'), html);
console.log(`docs/ThapSao.html written: ${(html.length / 1e6).toFixed(1)} MB, ${Object.keys(assets).length} embedded files`);
