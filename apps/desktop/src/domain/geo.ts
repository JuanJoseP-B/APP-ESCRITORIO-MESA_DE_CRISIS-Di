import distance from '@turf/distance';
import type { Coordenadas, Incidente } from '@argos/shared';

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

/**
 * Punto del incidente: `perimetro.centro` si existe; si no, su punto o el centroide de los vértices del
 * anillo exterior (sin repetir el vértice de cierre). Es la misma regla que `ubicacion_de_incidente` en la 0006.
 */
export function ubicacionDeIncidente(incidente: Pick<Incidente, 'geometria' | 'perimetro'>): Coordenadas {
  if (incidente.perimetro) return incidente.perimetro.centro;
  const { geometria } = incidente;
  if (geometria.type === 'Point') return { lng: geometria.coordinates[0], lat: geometria.coordinates[1] };
  const anillo = geometria.coordinates[0] ?? [];
  const vertices = anillo.length > 1 ? anillo.slice(0, -1) : anillo;
  if (vertices.length === 0) return { lng: 0, lat: 0 };
  const suma = vertices.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), { lng: 0, lat: 0 });
  return { lng: suma.lng / vertices.length, lat: suma.lat / vertices.length };
}
