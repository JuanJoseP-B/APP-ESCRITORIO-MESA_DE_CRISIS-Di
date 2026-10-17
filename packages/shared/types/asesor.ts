import type { TipoEmergencia } from './emergencia';
import type { Coordenadas } from './geo';
import type { Prioridad } from './llamada';
import type { Anillo, RadiosPerimetro } from './perimetro';
import type { EstadoRecurso, TipoRecurso } from './recurso';

export const CONFIANZAS_ASESOR = ['ALTA', 'MEDIA', 'BAJA'] as const;
export type ConfianzaAsesor = (typeof CONFIANZAS_ASESOR)[number];

/**
 * Entrada del asesor (ROADMAP §5.4). No lleva datos del reportante (nombre ni teléfono): lo arma el cliente
 * y es lo único que un motor, local o remoto, llega a ver.
 */
export interface SnapshotAsesor {
  readonly version: 1;
  /** ISO 8601, hora de la consola. */
  readonly generadoEn: string;
  readonly incidente: {
    readonly id: string;
    readonly codigo: string;
    /** `null` en incidentes anteriores al CAD: sin tipo no hay protocolo que aplicar. */
    readonly tipo: TipoEmergencia | null;
    readonly prioridad: Prioridad;
    readonly ubicacion: Coordenadas;
    readonly descripcion: string;
    readonly llamadasVinculadas: number;
    readonly minutosAbierto: number;
    readonly perimetroActual: RadiosPerimetro | null;
  };
  /** Unidades con ubicación que no están INOPERATIVAS (las ocupadas dan contexto; solo las DISPONIBLES se recomiendan). */
  readonly recursos: ReadonlyArray<{
    readonly id: string;
    readonly indicativo: string;
    readonly tipo: TipoRecurso;
    readonly estado: EstadoRecurso;
    /** Incidente al que está asignada; `null` si está libre. */
    readonly incidenteId: string | null;
    readonly ubicacion: Coordenadas;
    /** Metros en línea recta hasta el incidente, precalculados en el cliente. */
    readonly distanciaM: number;
  }>;
  readonly refugios: ReadonlyArray<{
    readonly id: string;
    readonly nombre: string;
    readonly ubicacion: Coordenadas;
    readonly ocupacion: number;
    readonly capacidad: number;
    /** Anillo del perímetro de protocolo que toca; `FUERA` si no toca ninguno. */
    readonly anillo: Anillo | 'FUERA';
  }>;
  /** Hallazgos del análisis espacial y del SLA que no se deducen de las listas anteriores. */
  readonly contexto: {
    /** Ids de recurso asignados a este incidente con el SLA vencido. */
    readonly slaVencidos: readonly string[];
    /** Ids de recurso dentro de la zona caliente que no atienden este incidente. */
    readonly unidadesEnZonaCaliente: readonly string[];
  };
}

/** Salida del asesor (ROADMAP §5.5). */
export interface RecomendacionAsesor {
  readonly idRecomendacion: string;
  readonly unidades: ReadonlyArray<{
    /** Debe existir en el snapshot y estar DISPONIBLE. */
    readonly idRecurso: string;
    readonly rol: string;
    readonly etaMin: number;
  }>;
  /** ≤ 600 caracteres. */
  readonly justificacion: string;
  readonly perimetroSugerido: RadiosPerimetro;
  readonly refugioSugeridoId: string | null;
  readonly advertencias: readonly string[];
  readonly confianza: ConfianzaAsesor;
}

export const ERRORES_ASESOR = ['SIN_CLAVE', 'SIN_RED', 'TIMEOUT', 'RESPUESTA_INVALIDA', 'API', 'SIN_RECOMENDACION'] as const;
export type ErrorAsesor = (typeof ERRORES_ASESOR)[number];

/** `SIN_RECOMENDACION`: el motor funcionó, pero el incidente no admite recomendación (p. ej. no tiene tipo). */
export type ResultadoAsesor =
  | { readonly ok: true; readonly recomendacion: RecomendacionAsesor }
  | { readonly ok: false; readonly error: ErrorAsesor; readonly detalle: string };

/**
 * Lo que debe implementar cualquier motor del asesor: el de reglas local hoy; un modelo de lenguaje detrás de un
 * comando de Tauri mañana. Solo ve el snapshot.
 */
export interface MotorAsesor {
  recomendar(snapshot: SnapshotAsesor): Promise<ResultadoAsesor>;
}
