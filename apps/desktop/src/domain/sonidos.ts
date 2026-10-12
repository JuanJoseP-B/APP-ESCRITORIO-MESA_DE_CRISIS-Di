import type { Incidente, Llamada, Prioridad, Recurso } from '@argos/shared';
import { rangoPrioridad } from '@argos/shared';

export const SONIDOS = ['llamadaP1', 'llamadaP2', 'llamadaSuave', 'slaVencido', 'despacho', 'resuelto', 'arranque'] as const;
export type Sonido = (typeof SONIDOS)[number];

export type OndaSonido = 'sine' | 'triangle' | 'square';

/** Una nota sintetizada: tiempos en segundos desde el inicio del patrón y ganancia de 0 a 1. */
export interface NotaSonido {
  readonly inicio: number;
  readonly duracion: number;
  readonly frecuencia: number;
  /** Si se indica, el tono se desliza hasta esta frecuencia al final de la nota. */
  readonly hasta?: number;
  readonly onda: OndaSonido;
  readonly ganancia: number;
}

/**
 * Patrones de la consola. Cuanto más urgente, más agudo y más repetido: P1 es un doble tono, P2 un tono medio,
 * P3/P4 un tono suave. El SLA vencido desciende, el despacho es un clic y el incidente resuelto un acorde mayor.
 */
export const PATRONES: Readonly<Record<Sonido, readonly NotaSonido[]>> = {
  llamadaP1: [
    { inicio: 0, duracion: 0.11, frecuencia: 1320, onda: 'square', ganancia: 0.35 },
    { inicio: 0.16, duracion: 0.11, frecuencia: 1320, onda: 'square', ganancia: 0.35 },
  ],
  llamadaP2: [{ inicio: 0, duracion: 0.18, frecuencia: 880, onda: 'triangle', ganancia: 0.5 }],
  llamadaSuave: [{ inicio: 0, duracion: 0.2, frecuencia: 587, onda: 'sine', ganancia: 0.3 }],
  slaVencido: [{ inicio: 0, duracion: 0.35, frecuencia: 660, hasta: 330, onda: 'triangle', ganancia: 0.5 }],
  despacho: [{ inicio: 0, duracion: 0.03, frecuencia: 1000, onda: 'square', ganancia: 0.3 }],
  resuelto: [
    { inicio: 0, duracion: 0.3, frecuencia: 523.25, onda: 'sine', ganancia: 0.25 },
    { inicio: 0, duracion: 0.3, frecuencia: 659.25, onda: 'sine', ganancia: 0.25 },
    { inicio: 0, duracion: 0.3, frecuencia: 783.99, onda: 'sine', ganancia: 0.25 },
  ],
  arranque: [{ inicio: 0, duracion: 0.22, frecuencia: 784, onda: 'sine', ganancia: 0.4 }],
};

const SONIDO_LLAMADA: Readonly<Record<Prioridad, Sonido>> = { P1: 'llamadaP1', P2: 'llamadaP2', P3: 'llamadaSuave', P4: 'llamadaSuave' };

export const sonidoDeLlamada = (prioridad: Prioridad): Sonido => SONIDO_LLAMADA[prioridad];

/** Segundos que tarda en sonar el patrón completo. */
export const duracionPatron = (patron: readonly NotaSonido[]): number => Math.max(0, ...patron.map((n) => n.inicio + n.duracion));

export const VOLUMEN_POR_DEFECTO = 60;

/** Volumen de 0 a 100, acotado y entero; lo que no sea un número vuelve al valor por defecto. */
export function normalizarVolumen(valor: number): number {
  return Number.isFinite(valor) ? Math.min(100, Math.max(0, Math.round(valor))) : VOLUMEN_POR_DEFECTO;
}

/** Ganancia de salida (0–1): en silencio siempre 0. */
export const gananciaMaestra = (volumen: number, silenciado: boolean): number => (silenciado ? 0 : normalizarVolumen(volumen) / 100);

/** Lo que la consola compara entre dos momentos para decidir qué suena. */
export interface InstantaneaSonora {
  /** Llamadas en la bandeja de entrantes, con su prioridad. */
  readonly entrantes: ReadonlyMap<string, Prioridad>;
  readonly vencidas: ReadonlySet<string>;
  /** Despachos vigentes, como `recurso:incidente`. */
  readonly despachos: ReadonlySet<string>;
  readonly resueltos: ReadonlySet<string>;
}

export function instantaneaSonora(datos: {
  readonly entrantes: readonly Pick<Llamada, 'id' | 'prioridad'>[];
  readonly unidadesVencidas: readonly string[];
  readonly recursos: readonly Pick<Recurso, 'id' | 'estado_actual' | 'incidente_asignado_id'>[];
  readonly incidentes: readonly Pick<Incidente, 'id' | 'estado'>[];
}): InstantaneaSonora {
  return {
    entrantes: new Map(datos.entrantes.map((l) => [l.id, l.prioridad])),
    vencidas: new Set(datos.unidadesVencidas),
    despachos: new Set(datos.recursos.filter((r) => r.estado_actual === 'ASIGNADO').map((r) => `${r.id}:${r.incidente_asignado_id ?? ''}`)),
    resueltos: new Set(datos.incidentes.filter((i) => i.estado === 'Resuelto').map((i) => i.id)),
  };
}

const hayNuevo = (previo: ReadonlySet<string>, actual: ReadonlySet<string>): boolean => [...actual].some((id) => !previo.has(id));

/**
 * Sonidos que corresponden a lo que cambió, del más urgente al menos. Sin instantánea previa (carga inicial)
 * no suena nada. Varias llamadas a la vez dan un solo aviso, el de la más prioritaria; cada evento suena una vez.
 */
export function sonidosDeCambios(previa: InstantaneaSonora | null, actual: InstantaneaSonora): readonly Sonido[] {
  if (!previa) return [];
  const sonidos: Sonido[] = [];
  const nuevas = [...actual.entrantes].filter(([id]) => !previa.entrantes.has(id)).map(([, prioridad]) => prioridad);
  const urgente = nuevas.sort((a, b) => rangoPrioridad(a) - rangoPrioridad(b))[0];
  if (urgente) sonidos.push(sonidoDeLlamada(urgente));
  if (hayNuevo(previa.vencidas, actual.vencidas)) sonidos.push('slaVencido');
  if (hayNuevo(previa.resueltos, actual.resueltos)) sonidos.push('resuelto');
  if (hayNuevo(previa.despachos, actual.despachos)) sonidos.push('despacho');
  return sonidos;
}
