import type { NivelCriticidad } from './incidente';

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
