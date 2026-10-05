import type { GeoJsonLineString, GeoJsonPolygon, Posicion } from '@argos/shared';
import { construirPoligono } from './poligono';

export const MODOS_TRAZADO = ['poligono', 'linea'] as const;
export type ModoTrazado = (typeof MODOS_TRAZADO)[number];

export type FiguraTrazada = GeoJsonPolygon | GeoJsonLineString;

export type ResultadoTrazado =
  | { readonly valido: true; readonly figura: FiguraTrazada }
  | { readonly valido: false; readonly error: string };

/** Geometría tal como la entrega la herramienta de dibujo, sin garantías de forma. */
export interface GeometriaDibujada {
  readonly type: string;
  readonly coordinates: unknown;
}

function aPosiciones(valor: unknown): readonly Posicion[] {
  if (!Array.isArray(valor)) return [];
  return valor.flatMap((c: unknown): Posicion[] => {
    if (!Array.isArray(c)) return [];
    const [lng, lat]: readonly unknown[] = c;
    return typeof lng === 'number' && typeof lat === 'number' ? [[lng, lat]] : [];
  });
}

/** Valida y normaliza la figura dibujada a GeoJSON persistible (polígono cerrado o línea de 2+ puntos). */
export function figuraDesdeDibujo(geometria: GeometriaDibujada): ResultadoTrazado {
  if (geometria.type === 'Polygon') {
    const anillos: readonly unknown[] = Array.isArray(geometria.coordinates) ? geometria.coordinates : [];
    const resultado = construirPoligono(aPosiciones(anillos[0]));
    return resultado.valido ? { valido: true, figura: resultado.poligono } : resultado;
  }
  if (geometria.type === 'LineString') {
    const puntos = aPosiciones(geometria.coordinates);
    const distintos = new Set(puntos.map((p) => `${p[0]},${p[1]}`));
    if (distintos.size < 2) return { valido: false, error: 'Se requieren al menos 2 puntos distintos' };
    return { valido: true, figura: { type: 'LineString', coordinates: puntos } };
  }
  return { valido: false, error: `Figura no admitida: ${geometria.type}` };
}
