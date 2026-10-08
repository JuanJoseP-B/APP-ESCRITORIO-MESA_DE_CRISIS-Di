import type { Coordenadas } from './geo';

export const TIPOS_RECURSO = ['Bomberos', 'Ambulancia', 'Policía'] as const;
export type TipoRecurso = (typeof TIPOS_RECURSO)[number];

/** Ciclo de vida CAD: DISPONIBLE → ASIGNADO → EN_RUTA → EN_ESCENA → DISPONIBLE. */
export const ESTADOS_RECURSO = ['DISPONIBLE', 'ASIGNADO', 'EN_RUTA', 'EN_ESCENA', 'INOPERATIVO'] as const;
export type EstadoRecurso = (typeof ESTADOS_RECURSO)[number];

/** Uso interno de la Mesa de Crisis: solo operadores autenticados leen o escriben recursos. */
export interface Recurso {
  readonly id: string;
  readonly tipo: TipoRecurso;
  readonly estado_actual: EstadoRecurso;
  readonly incidente_asignado_id: string | null;
  /** Código visible de la unidad (p. ej. "U01"). */
  readonly etiqueta?: string | null;
  /** Posición actual: la base mientras está libre y la del incidente cuando llega a la escena. `null` = sin posición conocida. */
  readonly ubicacion?: Coordenadas | null;
  /** Base de la unidad; al quedar DISPONIBLE regresa a ella. */
  readonly base?: Coordenadas | null;
}

/**
 * Transiciones permitidas. Cancelar un despacho (ASIGNADO o EN_RUTA → DISPONIBLE) es válido; saltar
 * de DISPONIBLE a EN_RUTA o EN_ESCENA, no. La migración 0006 aplica esta misma tabla en un trigger.
 */
export const TRANSICIONES_RECURSO: Record<EstadoRecurso, readonly EstadoRecurso[]> = {
  DISPONIBLE: ['ASIGNADO', 'INOPERATIVO'],
  ASIGNADO: ['EN_RUTA', 'DISPONIBLE', 'INOPERATIVO'],
  EN_RUTA: ['EN_ESCENA', 'DISPONIBLE', 'INOPERATIVO'],
  EN_ESCENA: ['DISPONIBLE', 'INOPERATIVO'],
  INOPERATIVO: ['DISPONIBLE'],
};

export function puedeTransicionar(desde: EstadoRecurso, hacia: EstadoRecurso): boolean {
  return TRANSICIONES_RECURSO[desde].includes(hacia);
}

/**
 * Aplica una transición validada sin mutar. Asignar exige `incidenteId`. La posición se copia a la del
 * incidente (`ubicacionIncidente`) al llegar a la escena y se restaura a la base al quedar disponible; una
 * posición corregida a mano se conserva en el resto de transiciones.
 */
export function transicionarRecurso(
  recurso: Recurso,
  hacia: EstadoRecurso,
  incidenteId?: string,
  ubicacionIncidente?: Coordenadas | null,
): Recurso {
  if (!puedeTransicionar(recurso.estado_actual, hacia)) {
    throw new Error(`Transición inválida: ${recurso.estado_actual} → ${hacia}`);
  }
  if (hacia === 'ASIGNADO') {
    if (!incidenteId) throw new Error('Despachar un recurso exige un incidente asignado');
    return { ...recurso, estado_actual: hacia, incidente_asignado_id: incidenteId };
  }
  const conserva = hacia === 'EN_RUTA' || hacia === 'EN_ESCENA';
  const siguiente: Recurso = {
    ...recurso,
    estado_actual: hacia,
    incidente_asignado_id: conserva ? recurso.incidente_asignado_id : null,
  };
  if (hacia === 'EN_ESCENA' && ubicacionIncidente) return { ...siguiente, ubicacion: ubicacionIncidente };
  if (hacia === 'DISPONIBLE' && recurso.base) return { ...siguiente, ubicacion: recurso.base };
  return siguiente;
}
