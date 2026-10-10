import { serve, launch, root } from './browser.mjs'; import path from 'node:path'; import fs from 'node:fs';
const out = path.join(root, 'out/probe'); fs.mkdirSync(out, { recursive: true });
const { srv, url } = await serve(path.join(root, process.argv[2] ?? 'dist'));
const b = await launch(); const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = []; p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); }); p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
await p.goto(url + '/?debug=1'); 
await p.waitForFunction(() => window.__TS && window.__TS.scenes().includes('Hub'), null, { timeout: 60000 }).catch(e => errs.push('timeout hub'));
await p.waitForTimeout(1500); await p.screenshot({ path: path.join(out, 'hub.png') });
const script = process.argv[3]; if (script) { const r = await p.evaluate(script); console.log('eval:', JSON.stringify(r)?.slice(0, 2000)); await p.waitForTimeout(+process.argv[4] || 2500); await p.screenshot({ path: path.join(out, 'after.png') }); }
console.log(JSON.stringify(await p.evaluate(() => { const s = window.__TS?.getState(); return s && { scenes: s.scenes, placeholders: s.placeholders, room: s.room, run: s.run && { pos: s.run.pos, ch: s.run.chapter } }; })).slice(0, 3000));
console.log(errs.slice(0, 30).join('\n'));
await b.close(); srv.close();
