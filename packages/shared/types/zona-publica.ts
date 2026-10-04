import type { GeoJsonGeometry } from './geo';

export const TIPOS_ZONA_PUBLICA = ['Refugio', 'Bloqueo de Vía'] as const;
export type TipoZonaPublica = (typeof TIPOS_ZONA_PUBLICA)[number];

export interface ZonaPublica {
  readonly id: string;
  readonly tipo: TipoZonaPublica;
  readonly nombre: string;
  readonly geometria: GeoJsonGeometry;
  readonly capacidad_actual: number;
  readonly capacidad_maxima: number;
}

/** Nueva ocupación tras sumar `delta`, acotada entre 0 y la capacidad máxima. */
export function ajustarOcupacion(zona: Pick<ZonaPublica, 'capacidad_actual' | 'capacidad_maxima'>, delta: number): number {
  return Math.min(zona.capacidad_maxima, Math.max(0, zona.capacidad_actual + delta));
}
