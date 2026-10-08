import { describe, expect, it } from 'vitest';
import { pinturaBasemap } from './basemap';

describe('pinturaBasemap', () => {
  it.each(['crema', 'carbon', undefined, 'otro'])('desatura casi por completo el tema %s', (tema) => {
    expect(pinturaBasemap(tema)['raster-saturation']).toBeLessThanOrEqual(-0.9);
  });

  it('en carbón oscurece los tiles; en crema los deja claros', () => {
    expect(pinturaBasemap('carbon')['raster-brightness-max']).toBeLessThan(0.5);
    expect(pinturaBasemap('crema')['raster-brightness-max']).toBe(1);
  });

  it('cualquier tema desconocido usa la pintura de crema (día)', () => {
    expect(pinturaBasemap(undefined)).toEqual(pinturaBasemap('crema'));
    expect(pinturaBasemap('otro')).toEqual(pinturaBasemap('crema'));
  });

  it('respeta los rangos válidos de MapLibre (-1..1 y brillo 0..1)', () => {
    for (const tema of ['crema', 'carbon']) {
      const p = pinturaBasemap(tema);
      expect(p['raster-saturation']).toBeGreaterThanOrEqual(-1);
      expect(p['raster-contrast']).toBeGreaterThanOrEqual(-1);
      expect(p['raster-brightness-min']).toBeLessThanOrEqual(p['raster-brightness-max']);
      expect(p['raster-brightness-min']).toBeGreaterThanOrEqual(0);
      expect(p['raster-brightness-max']).toBeLessThanOrEqual(1);
    }
  });
});
