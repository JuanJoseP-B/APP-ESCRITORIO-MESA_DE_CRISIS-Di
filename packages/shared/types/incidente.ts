import type { TipoEmergencia } from './emergencia';
import type { GeoJsonGeometry } from './geo';
import type { Prioridad } from './llamada';
import type { OrigenPerimetro, PerimetroRiesgo } from './perimetro';

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
  /** Prioridad CAD (P1 la más urgente); gobierna el orden de la cola y los umbrales de SLA. */
  readonly prioridad: Prioridad;
  /** Tipo de emergencia; `null` en incidentes anteriores al CAD (perímetro por defecto, sin coincidencia de tipo). */
  readonly tipo: TipoEmergencia | null;
  readonly estado: EstadoIncidente;
  readonly geometria: GeoJsonGeometry;
  readonly timeline: readonly EventoTimeline[];
  /** Fecha y hora ISO 8601 de apertura; la fija la base de datos. */
  readonly creado_en?: string;
  /** Perímetro de riesgo (centro, radios y origen); `null` si aún no se generó. */
  readonly perimetro?: PerimetroRiesgo | null;
  /** Copia de `perimetro.origen` como columna propia (`incidentes.perimetro_origen`). */
  readonly perimetro_origen?: OrigenPerimetro | null;
}

/** Vista pública de un incidente: sin `timeline` ni datos tácticos. */
export type ZonaRiesgo = Pick<Incidente, 'id' | 'titulo' | 'nivel_criticidad' | 'estado' | 'geometria'>;

/** Datos para crear un incidente; el `id` lo genera la base de datos. */
export type NuevoIncidente = Omit<Incidente, 'id' | 'creado_en'>;

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
