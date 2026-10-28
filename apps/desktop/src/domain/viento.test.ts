import { describe, expect, it } from 'vitest';
import { haciaDeg, rumbo, vientoSimulado } from './viento';

describe('viento', () => {
  it('el viento del suroeste empuja la nube hacia el noreste', () => {
    expect(haciaDeg({ fromDeg: 224 })).toBe(44);
    expect(haciaDeg({ fromDeg: 350 })).toBe(170);
  });

  it.each([
    [0, 0],
    [22, 0],
    [23, 1],
    [44, 1],
    [90, 2],
    [224, 5],
    [315, 7],
    [338, 0],
    [-45, 7],
  ])('%i° está en el rumbo %i', (deg, esperado) => {
    expect(rumbo(deg)).toBe(esperado);
  });

  it('el mock arranca del suroeste a 14 km/h y oscila poco a lo largo del escenario', () => {
    expect(vientoSimulado(0)).toEqual({ speedKmh: 14, fromDeg: 224 });
    for (let t = 0; t <= 480; t += 30) {
      const v = vientoSimulado(t);
      expect(v.speedKmh).toBeGreaterThanOrEqual(12);
      expect(v.speedKmh).toBeLessThanOrEqual(16);
      expect(Math.abs(v.fromDeg - 224)).toBeLessThanOrEqual(6);
    }
  });
});
