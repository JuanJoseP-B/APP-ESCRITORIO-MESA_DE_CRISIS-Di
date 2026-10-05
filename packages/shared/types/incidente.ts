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

/** Datos para crear un incidente; el `id` lo genera la base de datos. */
export type NuevoIncidente = Omit<Incidente, 'id'>;

/** Devuelve un `timeline` nuevo con el evento añadido al final (sin mutar). */
export function agregarEvento(
  timeline: readonly EventoTimeline[],
  descripcion: string,
  ahora: Date = new Date(),
  autor?: string,
): readonly EventoTimeline[] {
  const evento: EventoTimeline = autor
    ? { timestamp: ahora.toISOString(), descripcion, autor }
    : { timestamp: ahora.toISOString(), descripcion };
  return [...timeline, evento];
}
