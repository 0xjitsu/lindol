import { describe, expect, it } from 'vitest';
import sample from '../../tests/fixtures/usgs-sample.json';
import empty from '../../tests/fixtures/usgs-empty.json';
import { buildUrl, closest, filterQuakes, parseGeoJson, strongest, summarize, type Params, type Quake } from './quakes';
import { haversineKm } from './geo';

const NOW = Date.parse('2026-11-18T05:00:00Z');
const H = 3600e3;
const P: Params = { lat: 14.5995, lon: 120.9842, radiusKm: 200, periodHours: 168, minMag: 2.5 };
const q = (o: Partial<Quake>): Quake => ({ id: 'x', mag: 3, magType: 'ml', depthKm: 10, place: 'p', time: NOW - H, lat: 14.5995, lon: 120.9842, url: '', ...o });

describe('parseGeoJson', () => {
  it('parses the fixture, keeping null magnitude and depth', () => {
    const all = parseGeoJson(sample);
    expect(all).toHaveLength(7);
    expect(all.find((x) => x.id === 'us7000fx06')?.mag).toBeNull();
    expect(all.find((x) => x.id === 'us7000fx03')?.depthKm).toBeNull();
    expect(parseGeoJson(empty)).toEqual([]);
  });
  it('rejects non-USGS event urls and throws on bad shape', () => {
    const bad = { features: [{ id: 'a', properties: { time: 1, url: 'javascript:alert(1)' }, geometry: { coordinates: [120, 14, 5] } }] };
    expect(parseGeoJson(bad)[0].url).toBe('');
    expect(() => parseGeoJson({})).toThrow();
  });
});

describe('buildUrl', () => {
  it('uses documented FDSN parameters', () => {
    const u = new URL(buildUrl(P, NOW));
    expect(u.origin + u.pathname).toBe('https://earthquake.usgs.gov/fdsnws/event/1/query');
    expect(Object.fromEntries(u.searchParams)).toEqual({
      format: 'geojson', latitude: '14.5995', longitude: '120.9842', maxradiuskm: '200',
      starttime: '2026-11-11T05:00:00.000Z', minmagnitude: '2.5', orderby: 'time', limit: '200',
    });
  });
});

describe('filterQuakes edges', () => {
  it('radius is inclusive at the exact distance', () => {
    const lat = 16.0;
    const d = haversineKm(P.lat, P.lon, lat, P.lon);
    expect(filterQuakes([q({ lat })], { ...P, radiusKm: d }, NOW)).toHaveLength(1);
    expect(filterQuakes([q({ lat })], { ...P, radiusKm: d - 0.001 }, NOW)).toHaveLength(0);
  });
  it('period start is inclusive', () => {
    const start = NOW - 24 * H;
    expect(filterQuakes([q({ time: start })], { ...P, periodHours: 24 }, NOW)).toHaveLength(1);
    expect(filterQuakes([q({ time: start - 1 })], { ...P, periodHours: 24 }, NOW)).toHaveLength(0);
  });
  it('minimum magnitude is inclusive', () => {
    expect(filterQuakes([q({ mag: 4.0 })], { ...P, minMag: 4 }, NOW)).toHaveLength(1);
    expect(filterQuakes([q({ mag: 3.9 })], { ...P, minMag: 4 }, NOW)).toHaveLength(0);
  });
  it('drops quakes with no magnitude but keeps those with no depth', () => {
    const out = filterQuakes([q({ id: 'a', mag: null }), q({ id: 'b', depthKm: null })], P, NOW);
    expect(out.map((x) => x.id)).toEqual(['b']);
    expect(out[0].depthKm).toBeNull();
  });
  it('sorts newest first and adds distance and direction', () => {
    const out = filterQuakes(parseGeoJson(sample), P, NOW);
    expect(out.map((x) => x.id)).toEqual(['us7000fx01', 'us7000fx02', 'us7000fx04', 'us7000fx03']);
    expect(out[0].distanceKm).toBeGreaterThan(100);
    expect(out[0].direction).toMatch(/^[NSEW]{1,3}$/);
  });
});

describe('strongest / closest / headline agree with the shown list', () => {
  const list = filterQuakes(parseGeoJson(sample), P, NOW);
  it('picks from the filtered list only (excludes the M6.0 outside the radius and old M4.9)', () => {
    expect(strongest(list)?.id).toBe('us7000fx01');
    expect(strongest(list)?.mag).toBe(5.2);
    expect(closest(list)?.id).toBe('us7000fx02');
  });
  it('summary is derived from the same list', () => {
    const s = summarize(list);
    expect(s.count).toBe(list.length);
    expect(list).toContain(s.strongest);
    expect(list).toContain(s.closest);
    expect(s.strongest?.mag).toBe(Math.max(...list.map((x) => x.mag ?? -1)));
    expect(s.closest?.distanceKm).toBe(Math.min(...list.map((x) => x.distanceKm)));
  });
  it('changes with the filter: raising minimum magnitude changes closest', () => {
    const s = summarize(filterQuakes(parseGeoJson(sample), { ...P, minMag: 4 }, NOW));
    expect(s.count).toBe(2);
    expect(s.closest?.id).not.toBe('us7000fx02');
  });
  it('ties: equal magnitude prefers closer; equal distance prefers stronger', () => {
    const near = q({ id: 'near', mag: 5, lat: 14.7 });
    const far = q({ id: 'far', mag: 5, lat: 15.5 });
    const l = filterQuakes([far, near], P, NOW);
    expect(strongest(l)?.id).toBe('near');
    const a = q({ id: 'a', mag: 3 }), b = q({ id: 'b', mag: 4 });
    expect(closest(filterQuakes([a, b], P, NOW))?.id).toBe('b');
  });
  it('empty list gives nulls', () => {
    expect(summarize([])).toEqual({ count: 0, strongest: null, closest: null });
  });
});
