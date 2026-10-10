// Summarise a .cpuprofile: top self-time functions and inclusive time for a few roots.
import fs from 'node:fs';
const prof = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')); const N = +(process.argv[3] ?? 30);
const byId = new Map(prof.nodes.map((n) => [n.id, n])); const self = new Map();
const dt = prof.timeDeltas; const counts = new Map(); prof.samples.forEach((id, i) => counts.set(id, (counts.get(id) ?? 0) + (dt[i] ?? 0)));
for (const n of prof.nodes) { const k = `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop()}:${n.callFrame.lineNumber}`; self.set(k, (self.get(k) ?? 0) + (counts.get(n.id) ?? 0)); }
const tot = [...counts.values()].reduce((a, b) => a + b, 0);
console.log('total ms', (tot / 1000).toFixed(0));
for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, N)) console.log((v / 1000).toFixed(1).padStart(8), (100 * v / tot).toFixed(1).padStart(5) + '%', k);
