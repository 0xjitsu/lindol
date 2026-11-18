import type { Params, Quake } from './quakes';

const safe = {
  get(k: string): string | null {
    try { return localStorage.getItem(k); } catch { return null; }
  },
  set(k: string, v: string): void {
    try { localStorage.setItem(k, v); } catch { /* storage unavailable: ignore */ }
  },
};

export interface Controls { radiusKm: number; periodHours: number; minMag: number }
export const DEFAULT_CONTROLS: Controls = { radiusKm: 200, periodHours: 168, minMag: 2.5 };
export const RADII = [100, 200, 300, 500];
export const PERIODS = [24, 168, 720];
export const MAGS = [2.5, 4, 5];

export function loadControls(): Controls {
  try {
    const o = JSON.parse(safe.get('lindol.controls') ?? '{}');
    return {
      radiusKm: RADII.includes(o.radiusKm) ? o.radiusKm : DEFAULT_CONTROLS.radiusKm,
      periodHours: PERIODS.includes(o.periodHours) ? o.periodHours : DEFAULT_CONTROLS.periodHours,
      minMag: MAGS.includes(o.minMag) ? o.minMag : DEFAULT_CONTROLS.minMag,
    };
  } catch { return { ...DEFAULT_CONTROLS }; }
}
export const saveControls = (c: Controls) => safe.set('lindol.controls', JSON.stringify(c));
export const loadCity = () => safe.get('lindol.city');
export const saveCity = (name: string) => safe.set('lindol.city', name);
export const loadLang = (): 'en' | 'tl' => (safe.get('lindol.lang') === 'tl' ? 'tl' : 'en');
export const saveLang = (l: string) => safe.set('lindol.lang', l);

export interface Cached { key: string; fetchedAt: number; quakes: Quake[] }
export const cacheKey = (p: Params) => `${p.lat.toFixed(4)},${p.lon.toFixed(4)},${p.radiusKm},${p.periodHours},${p.minMag}`;
export function saveCache(c: Cached): void {
  safe.set('lindol.last', JSON.stringify(c));
}
export function loadCache(key: string): Cached | null {
  try {
    const c = JSON.parse(safe.get('lindol.last') ?? 'null');
    return c && c.key === key && Array.isArray(c.quakes) && typeof c.fetchedAt === 'number' ? c : null;
  } catch { return null; }
}
