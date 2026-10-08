import type { EstadoRecurso } from './recurso';
import type { Prioridad } from './llamada';

export const ORIGENES_EVENTO_RECURSO = ['MANUAL', 'IA', 'SISTEMA'] as const;
export type OrigenEventoRecurso = (typeof ORIGENES_EVENTO_RECURSO)[number];

/** Transición de un recurso registrada con la hora del servidor (tabla `eventos_recurso`, solo inserción). */
export interface EventoRecurso {
  readonly id: string;
  readonly recursoId: string;
  readonly incidenteId: string | null;
  readonly desde: EstadoRecurso;
  readonly hacia: EstadoRecurso;
  readonly origen: OrigenEventoRecurso;
  /** ISO 8601, hora del servidor. */
  readonly creadoEn: string;
}

export interface UmbralSla {
  /** Segundos desde ASIGNADO hasta EN_RUTA. */
  readonly aEnRutaSeg: number;
  /** Segundos desde ASIGNADO hasta EN_ESCENA. */
  readonly aEnEscenaSeg: number;
  /** Fracción del límite (0..1) a partir de la cual el cronómetro pasa a ALERTA. */
  readonly alertaPrevia: number;
}

export const SLA_POR_PRIORIDAD: Readonly<Record<Prioridad, UmbralSla>> = {
  P1: { aEnRutaSeg: 2 * 60, aEnEscenaSeg: 10 * 60, alertaPrevia: 0.8 },
  P2: { aEnRutaSeg: 3 * 60, aEnEscenaSeg: 15 * 60, alertaPrevia: 0.8 },
  P3: { aEnRutaSeg: 5 * 60, aEnEscenaSeg: 25 * 60, alertaPrevia: 0.8 },
  P4: { aEnRutaSeg: 10 * 60, aEnEscenaSeg: 45 * 60, alertaPrevia: 0.8 },
};

export type NivelSla = 'EN_TIEMPO' | 'ALERTA' | 'VENCIDO' | 'NO_APLICA';

export interface EstadoSla {
  readonly recursoId: string;
  /** Próximo hito esperado; `null` cuando el SLA no aplica (disponible, en escena, inoperativo). */
  readonly hito: 'EN_RUTA' | 'EN_ESCENA' | null;
  readonly transcurridoSeg: number;
  readonly limiteSeg: number | null;
  readonly nivel: NivelSla;
}
