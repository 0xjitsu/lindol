import { describe, expect, it } from 'vitest';
import { formatPHT, relative } from './time';

describe('formatPHT', () => {
  it('shifts +8h and rolls the date forward across the UTC midnight boundary', () => {
    expect(formatPHT(Date.parse('2026-11-18T16:00:00Z'))).toBe('19 Nov 2026, 00:00 PHT');
    expect(formatPHT(Date.parse('2026-11-18T15:59:00Z'))).toBe('18 Nov 2026, 23:59 PHT');
  });
  it('rolls month and year', () => {
    expect(formatPHT(Date.parse('2026-12-31T16:30:00Z'))).toBe('1 Jan 2027, 00:30 PHT');
  });
  it('early UTC morning stays on the same PHT day', () => {
    expect(formatPHT(Date.parse('2026-11-18T00:05:00Z'))).toBe('18 Nov 2026, 08:05 PHT');
  });
});

describe('relative', () => {
  const now = Date.parse('2026-11-18T05:00:00Z');
  it('buckets', () => {
    expect(relative(now - 30e3, now)).toEqual({ unit: 'now', n: 0 });
    expect(relative(now - 5 * 60e3, now)).toEqual({ unit: 'minute', n: 5 });
    expect(relative(now - 3 * 3600e3 - 1, now)).toEqual({ unit: 'hour', n: 3 });
    expect(relative(now - 49 * 3600e3, now)).toEqual({ unit: 'day', n: 2 });
  });
  it('treats future times as now', () => expect(relative(now + 1e6, now)).toEqual({ unit: 'now', n: 0 }));
});
