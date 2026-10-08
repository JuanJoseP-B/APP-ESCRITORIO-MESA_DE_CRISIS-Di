import type { TipoEmergencia } from './emergencia';
import type { Coordenadas } from './geo';
import type { NivelCriticidad } from './incidente';
import type { EstadoValidacion } from './reporte';

export const CANALES_LLAMADA = ['123', 'VHF', 'SENSOR', 'PRESENCIAL'] as const;
export type CanalLlamada = (typeof CANALES_LLAMADA)[number];

export const ETIQUETAS_CANAL_LLAMADA: Readonly<Record<CanalLlamada, string>> = {
  '123': 'Línea 123',
  VHF: 'Radio VHF',
  SENSOR: 'Sensor',
  PRESENCIAL: 'Presencial',
};

/** P1 es la más urgente (riesgo vital inmediato); P4 la menos. */
export const PRIORIDADES = ['P1', 'P2', 'P3', 'P4'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export const esPrioridad = (valor: unknown): valor is Prioridad =>
  (PRIORIDADES as readonly unknown[]).includes(valor);

/** Menor número = más urgente; sirve para ordenar la cola. */
export const rangoPrioridad = (prioridad: Prioridad): number => PRIORIDADES.indexOf(prioridad);

/** Equivalencia para incidentes anteriores a la prioridad CAD (la 0006 usa esta misma tabla). */
export const PRIORIDAD_POR_CRITICIDAD: Readonly<Record<NivelCriticidad, Prioridad>> = {
  Crítico: 'P1',
  Medio: 'P2',
  Bajo: 'P3',
};

/** Llamada o aviso registrado por el operador. Sin `incidenteId` está pendiente de vincular. */
export interface Llamada {
  readonly id: string;
  readonly canal: CanalLlamada;
  readonly tipo: TipoEmergencia;
  readonly prioridad: Prioridad;
  readonly ubicacion: Coordenadas;
  readonly narrativa: string;
  readonly reportante: string | null;
  readonly callback: string | null;
  /** `null` = sin vincular. */
  readonly incidenteId: string | null;
  readonly estadoValidacion: EstadoValidacion;
  readonly operadorId: string | null;
  /** ISO 8601, hora del servidor. */
  readonly creadoEn: string;
}

/** Lo que captura el formulario; el servicio fija el resto (id, operador, hora y estado). */
export type NuevaLlamada = Omit<Llamada, 'id' | 'creadoEn' | 'operadorId' | 'incidenteId' | 'estadoValidacion'>;

export interface CandidatoDuplicado {
  readonly incidenteId: string;
  readonly codigo: string;
  readonly distanciaM: number;
  readonly minutosDesde: number;
  /** 0..1 */
  readonly puntaje: number;
}

export interface ParametrosDuplicados {
  readonly radioMaxM: number;
  readonly ventanaMin: number;
  readonly umbral: number;
  readonly maxCandidatos: number;
}

export const PARAMETROS_DUPLICADOS: ParametrosDuplicados = {
  radioMaxM: 500,
  ventanaMin: 30,
  umbral: 0.6,
  maxCandidatos: 3,
};
