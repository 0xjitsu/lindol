const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const PHT_OFFSET_MS = 8 * 3600 * 1000; // Asia/Manila is UTC+8 all year (no DST)

/** "18 Nov 2026, 13:05 PHT" from epoch ms. Deterministic, no Intl dependency. */
export function formatPHT(ms: number): string {
  const d = new Date(ms + PHT_OFFSET_MS);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${p(d.getUTCHours())}:${p(d.getUTCMinutes())} PHT`;
}

export type RelUnit = 'now' | 'minute' | 'hour' | 'day';
export interface Relative { unit: RelUnit; n: number }

/** Relative age of an event. Future times (clock skew) are treated as "now". */
export function relative(ms: number, now: number): Relative {
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  if (s < 60) return { unit: 'now', n: 0 };
  if (s < 3600) return { unit: 'minute', n: Math.floor(s / 60) };
  if (s < 86400) return { unit: 'hour', n: Math.floor(s / 3600) };
  return { unit: 'day', n: Math.floor(s / 86400) };
}
