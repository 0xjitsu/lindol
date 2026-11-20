import { describe, expect, it } from 'vitest';
import { bearingDeg, compass, haversineKm } from './geo';

// Expected values computed independently with a separate Python implementation of the
// haversine / initial-bearing formulas (R = 6371.0088 km), not by this module.
const MANILA: [number, number] = [14.5995, 120.9842];
const CEBU: [number, number] = [10.3157, 123.8854];
const DAVAO: [number, number] = [7.1907, 125.4553];
const BAGUIO: [number, number] = [16.4023, 120.596];

describe('haversine', () => {
  it('Manila to Cebu City', () => expect(haversineKm(...MANILA, ...CEBU)).toBeCloseTo(571.026, 2));
  it('Manila to Davao City', () => expect(haversineKm(...MANILA, ...DAVAO)).toBeCloseTo(957.419, 2));
  it('Manila to Baguio', () => expect(haversineKm(...MANILA, ...BAGUIO)).toBeCloseTo(204.732, 2));
  it('is zero for identical points and symmetric', () => {
    expect(haversineKm(...MANILA, ...MANILA)).toBe(0);
    expect(haversineKm(...CEBU, ...MANILA)).toBeCloseTo(haversineKm(...MANILA, ...CEBU), 9);
  });
  it('one degree of longitude on the equator', () => expect(haversineKm(0, 0, 0, 1)).toBeCloseTo(111.195, 2));
});

describe('bearing', () => {
  it('Manila to Cebu City', () => expect(bearingDeg(...MANILA, ...CEBU)).toBeCloseTo(146.198, 2));
  it('Manila to Davao City', () => expect(bearingDeg(...MANILA, ...DAVAO)).toBeCloseTo(148.895, 2));
  it('Manila to Baguio', () => expect(bearingDeg(...MANILA, ...BAGUIO)).toBeCloseTo(348.329, 2));
  it('due east on the equator is 90', () => expect(bearingDeg(0, 0, 0, 1)).toBeCloseTo(90, 6));
  it('due south is 180 and due west is 270', () => {
    expect(bearingDeg(10, 120, 9, 120)).toBeCloseTo(180, 6);
    expect(bearingDeg(0, 121, 0, 120)).toBeCloseTo(270, 6);
  });
});

describe('compass', () => {
  it('maps bearings to 16 points', () => {
    expect(compass(0)).toBe('N');
    expect(compass(146.198)).toBe('SE');
    expect(compass(348.329)).toBe('NNW');
    expect(compass(359.9)).toBe('N');
    expect(compass(90)).toBe('E');
    expect(compass(11.24)).toBe('N');
    expect(compass(11.26)).toBe('NNE');
  });
});
