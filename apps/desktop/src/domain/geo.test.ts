import { describe, expect, it } from 'vitest';
import { aPosicion, distanciaM } from './geo';

/*
 * F2-T1. Coordenadas (Wikipedia, consultadas el 2026-10-08):
 *  - Plaza de Nariño (Pasto): 1°12′52″N 77°16′42″O = 1.2145833333333, -77.278305555556
 *    https://es.wikipedia.org/wiki/Plaza_de_Nari%C3%B1o_(Pasto)
 *  - Estadio Departamental Libertad: 1°11′52.84″N 77°16′39.39″W = 1.1980111, -77.2776083
 *    https://en.wikipedia.org/wiki/Estadio_Departamental_Libertad
 * Distancia de referencia: geodésica sobre el elipsoide WGS84 calculada con GeographicLib
 * (geographiclib-geodesic 2.x, Geodesic.WGS84.Inverse) = 1834.113 m. Haversine da ≈ 1844.4 m (0,56 %).
 */
const PLAZA_DE_NARINO = { lat: 1.2145833333333, lng: -77.278305555556 };
const ESTADIO_LIBERTAD = { lat: 1.1980111, lng: -77.2776083 };
const GEODESICA_WGS84_M = 1834.113;

describe('distanciaM (Haversine)', () => {
  it('Plaza de Nariño ↔ Estadio Libertad coincide con la geodésica WGS84 con error < 1 %', () => {
    const d = distanciaM(PLAZA_DE_NARINO, ESTADIO_LIBERTAD);
    expect(Math.abs(d - GEODESICA_WGS84_M) / GEODESICA_WGS84_M).toBeLessThan(0.01);
  });

  it('es simétrica y vale 0 entre un punto y sí mismo', () => {
    expect(distanciaM(PLAZA_DE_NARINO, PLAZA_DE_NARINO)).toBe(0);
    expect(distanciaM(PLAZA_DE_NARINO, ESTADIO_LIBERTAD)).toBeCloseTo(distanciaM(ESTADIO_LIBERTAD, PLAZA_DE_NARINO), 6);
  });

  it('un grado de latitud mide ≈ 111,2 km', () => {
    expect(distanciaM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 })).toBeCloseTo(111_195, -2);
  });

  it('aPosicion devuelve [lng, lat]', () => {
    expect(aPosicion({ lat: 1.2, lng: -77.3 })).toEqual([-77.3, 1.2]);
  });
});
