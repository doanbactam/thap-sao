// Seeded RNG (mulberry32). Framework-free.
export class Rng {
  s: number;
  constructor(seed = Date.now() >>> 0) { this.s = seed >>> 0 || 1; }
  next(): number { let t = (this.s += 0x6d2b79f5); t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
  int(a: number, b: number): number { return a + Math.floor(this.next() * (b - a + 1)); }
  range(a: number, b: number): number { return a + this.next() * (b - a); }
  chance(p: number): boolean { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  weighted<T>(items: readonly T[], w: (x: T) => number): T {
    let tot = 0; for (const it of items) tot += Math.max(0, w(it));
    let r = this.next() * tot; for (const it of items) { r -= Math.max(0, w(it)); if (r <= 0) return it; }
    return items[items.length - 1];
  }
  shuffle<T>(arr: T[]): T[] { for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; } return arr; }
}
