import type { GeoJsonLineString, GeoJsonPolygon, GeometriaZona } from './geo';

export const TIPOS_ZONA_PUBLICA = ['Refugio', 'Bloqueo de Vía'] as const;
export type TipoZonaPublica = (typeof TIPOS_ZONA_PUBLICA)[number];

export interface ZonaPublica {
  readonly id: string;
  readonly tipo: TipoZonaPublica;
  readonly nombre: string;
  readonly geometria: GeometriaZona;
  readonly capacidad_actual: number;
  readonly capacidad_maxima: number;
}

/** Nueva ocupación tras sumar `delta`, acotada entre 0 y la capacidad máxima. */
export function ajustarOcupacion(zona: Pick<ZonaPublica, 'capacidad_actual' | 'capacidad_maxima'>, delta: number): number {
  return Math.min(zona.capacidad_maxima, Math.max(0, zona.capacidad_actual + delta));
}

/** Datos para crear una zona pública; el `id` lo genera la base de datos. */
export type NuevaZonaPublica = Omit<ZonaPublica, 'id'>;

/** Zona pública a partir de una figura trazada por el operador en el mapa (sin aforo). */
export function zonaDesdeTrazado(geometria: GeoJsonPolygon | GeoJsonLineString, ahora: Date = new Date()): NuevaZonaPublica {
  const figura = geometria.type === 'Polygon' ? 'Zona trazada' : 'Tramo trazado';
  return {
    tipo: 'Bloqueo de Vía',
    nombre: `${figura} ${ahora.toISOString().slice(0, 16).replace('T', ' ')} UTC`,
    geometria,
    capacidad_actual: 0,
    capacidad_maxima: 0,
  };
}
