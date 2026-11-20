import { bearingDeg, compass, haversineKm } from './geo';

export interface Quake {
  id: string;
  mag: number | null;
  magType: string | null;
  depthKm: number | null;
  place: string;
  time: number; // epoch ms (UTC)
  lat: number;
  lon: number;
  url: string;
}
export interface QuakeView extends Quake {
  distanceKm: number;
  bearing: number;
  direction: string;
}
export interface Params {
  lat: number;
  lon: number;
  radiusKm: number;
  periodHours: number;
  minMag: number;
}

export const USGS_BASE = 'https://earthquake.usgs.gov/fdsnws/event/1/query';

export function buildUrl(p: Params, now: number): string {
  const start = new Date(now - p.periodHours * 3600 * 1000).toISOString();
  const q = new URLSearchParams({
    format: 'geojson',
    latitude: String(p.lat),
    longitude: String(p.lon),
    maxradiuskm: String(p.radiusKm),
    starttime: start,
    minmagnitude: String(p.minMag),
    orderby: 'time',
    limit: '200',
  });
  return `${USGS_BASE}?${q.toString()}`;
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Parse a USGS GeoJSON FeatureCollection; skips malformed features. */
export function parseGeoJson(json: unknown): Quake[] {
  const feats = (json as { features?: unknown })?.features;
  if (!Array.isArray(feats)) throw new Error('Unexpected response shape');
  const out: Quake[] = [];
  for (const f of feats) {
    const props = f?.properties ?? {};
    const c = f?.geometry?.coordinates;
    const time = num(props.time);
    if (!Array.isArray(c) || time === null) continue;
    const lon = num(c[0]);
    const lat = num(c[1]);
    if (lon === null || lat === null) continue;
    const url = typeof props.url === 'string' && props.url.startsWith('https://earthquake.usgs.gov/') ? props.url : '';
    out.push({
      id: String(f.id ?? `${time}-${lat}-${lon}`),
      mag: num(props.mag),
      magType: typeof props.magType === 'string' && props.magType ? props.magType : null,
      depthKm: num(c[2]),
      place: typeof props.place === 'string' ? props.place : '',
      time,
      lat,
      lon,
      url,
    });
  }
  return out;
}

/**
 * Filter to exactly what is shown. Edges are inclusive: distance <= radius,
 * magnitude >= minimum, time >= start of period. Quakes with no magnitude cannot
 * satisfy "M >= X" and are excluded. Sorted newest first.
 */
export function filterQuakes(quakes: Quake[], p: Params, now: number): QuakeView[] {
  const start = now - p.periodHours * 3600 * 1000;
  const out: QuakeView[] = [];
  for (const q of quakes) {
    if (q.mag === null || q.mag < p.minMag) continue;
    if (q.time < start || q.time > now + 5 * 60 * 1000) continue;
    const distanceKm = haversineKm(p.lat, p.lon, q.lat, q.lon);
    if (distanceKm > p.radiusKm) continue;
    const bearing = bearingDeg(p.lat, p.lon, q.lat, q.lon);
    out.push({ ...q, distanceKm, bearing, direction: compass(bearing) });
  }
  return out.sort((a, b) => b.time - a.time);
}

/** Strongest = highest magnitude (ties: closer, then newer). Null if list empty. */
export function strongest(list: QuakeView[]): QuakeView | null {
  let best: QuakeView | null = null;
  for (const q of list) {
    if (q.mag === null) continue;
    if (!best || q.mag > (best.mag ?? -Infinity) || (q.mag === best.mag && (q.distanceKm < best.distanceKm || (q.distanceKm === best.distanceKm && q.time > best.time)))) best = q;
  }
  return best;
}

/** Closest = smallest distance (ties: stronger, then newer). Null if list empty. */
export function closest(list: QuakeView[]): QuakeView | null {
  let best: QuakeView | null = null;
  for (const q of list) {
    if (!best || q.distanceKm < best.distanceKm || (q.distanceKm === best.distanceKm && ((q.mag ?? -Infinity) > (best.mag ?? -Infinity) || ((q.mag ?? -Infinity) === (best.mag ?? -Infinity) && q.time > best.time)))) best = q;
  }
  return best;
}

export interface Summary {
  count: number;
  strongest: QuakeView | null;
  closest: QuakeView | null;
}
/** Everything the headline says is derived from the same list that is rendered. */
export function summarize(list: QuakeView[]): Summary {
  return { count: list.length, strongest: strongest(list), closest: closest(list) };
}
