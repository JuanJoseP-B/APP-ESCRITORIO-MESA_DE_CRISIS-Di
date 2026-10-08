import distance from '@turf/distance';
import type { Coordenadas } from '@argos/shared';

/** Posición GeoJSON `[lng, lat]` de una coordenada. */
export const aPosicion = (c: Coordenadas): [number, number] => [c.lng, c.lat];

/**
 * Distancia en metros entre dos puntos por la fórmula de Haversine (esfera de radio medio terrestre,
 * 6 371 008,8 m). Frente a la geodésica WGS84 el error es del orden de 0,5 %, suficiente para duplicados
 * y perímetros de cientos de metros.
 */
export function distanciaM(a: Coordenadas, b: Coordenadas): number {
  return distance(aPosicion(a), aPosicion(b), { units: 'meters' });
}
