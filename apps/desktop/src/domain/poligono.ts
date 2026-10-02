import type { GeoJsonPolygon, Posicion } from '@argos/shared';

export type ResultadoPoligono =
  | { readonly valido: true; readonly poligono: GeoJsonPolygon }
  | { readonly valido: false; readonly error: string };

const iguales = (a: Posicion, b: Posicion): boolean => a[0] === b[0] && a[1] === b[1];

/**
 * Normaliza los vértices trazados a un polígono GeoJSON válido:
 * cierra el anillo si hace falta y exige al menos 3 vértices distintos.
 */
export function construirPoligono(vertices: readonly Posicion[]): ResultadoPoligono {
  const primero = vertices[0];
  const ultimo = vertices[vertices.length - 1];
  if (!primero || !ultimo) return { valido: false, error: 'Faltan vértices' };

  const abierto = iguales(primero, ultimo) ? vertices.slice(0, -1) : vertices;
  const unicos = abierto.filter((v, i) => abierto.findIndex((w) => iguales(v, w)) === i);
  if (unicos.length < 3) {
    return { valido: false, error: 'Se requieren al menos 3 vértices distintos' };
  }

  return { valido: true, poligono: { type: 'Polygon', coordinates: [[...abierto, primero]] } };
}
