import type { GeoJsonGeometry } from './geo';

export const NIVELES_CRITICIDAD = ['Bajo', 'Medio', 'Crítico'] as const;
export type NivelCriticidad = (typeof NIVELES_CRITICIDAD)[number];

export const ESTADOS_INCIDENTE = ['Abierto', 'Contenido', 'Resuelto'] as const;
export type EstadoIncidente = (typeof ESTADOS_INCIDENTE)[number];

export interface EventoTimeline {
  /** Fecha y hora ISO 8601. */
  readonly timestamp: string;
  readonly descripcion: string;
  readonly autor?: string;
}

export interface Incidente {
  readonly id: string;
  readonly titulo: string;
  readonly nivel_criticidad: NivelCriticidad;
  readonly estado: EstadoIncidente;
  readonly geometria: GeoJsonGeometry;
  readonly timeline: readonly EventoTimeline[];
}

/** Vista pública de un incidente: sin `timeline` ni datos tácticos. */
export type ZonaRiesgo = Pick<Incidente, 'id' | 'titulo' | 'nivel_criticidad' | 'estado' | 'geometria'>;
