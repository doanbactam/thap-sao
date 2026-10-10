import { describe, it, expect } from 'vitest';
import { t, DEFAULT_STRINGS } from '../src/systems/i18n';
describe('Vietnamese UI strings (C103)', () => {
  it('every engine key resolves to Vietnamese text', () => {
    for (const k of Object.keys(DEFAULT_STRINGS).filter((k) => DEFAULT_STRINGS[k])) { const v = t(k); expect(v).not.toBe(k); expect(v.length).toBeGreaterThan(0); }
  });
  it('uses Vietnamese diacritics', () => { expect(t('hub.name')).toMatch(/[ÀÁẢÃẠĂÂĐÊÔƠƯàáảãạăâđêôơư]/i); expect(t('cur.money')).toMatch(/Hạt Dẻ/); });
  it('variables are substituted', () => { expect(t('x {a}', { a: 1 })).toBe('x 1'); });
});
import fs from 'node:fs'; import path from 'node:path';
describe('no untranslated keys in engine code (C103)', () => {
  it('every literal t("…") key used in src resolves to text', () => {
    const files: string[] = []; const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (p.endsWith('.ts') && !p.includes('/data/')) files.push(p); } };
    walk(path.join(__dirname, '../src')); const missing: string[] = [];
    for (const f of files) for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\('([a-zA-Z][\w.]+)'\)/g)) if (t(m[1]) === m[1]) missing.push(`${path.basename(f)}: ${m[1]}`);
    expect(missing).toEqual([]);
  });
});
describe('templated keys resolve (C103)', () => {
  it('ev.*, node.*, rar.*, choice.*, fountain variants', () => {
    const keys = [...['arena', 'secret', 'clover', 'merchant', 'obelisk', 'fountain', 'companion', 'blood', 'pocket'].map((e) => `ev.${e}`),
      ...['levelup', 'artifact', 'enchant', 'tablet', 'money', 'heart', 'anvil', 'dice', 'shop', 'roots'].map((n) => `node.${n}`),
      ...['common', 'rare', 'epic', 'legendary'].map((r) => `rar.${r}`), ...['artifact', 'tablet', 'miracle', 'upgrade'].map((c) => `choice.${c}`),
      ...['green', 'gold', 'red'].map((f) => `ev.fountain.${f}`)];
    expect(keys.filter((k) => t(k) === k)).toEqual([]);
  });
});
