export const TIPOS_RECURSO = ['Bomberos', 'Ambulancia', 'Policía'] as const;
export type TipoRecurso = (typeof TIPOS_RECURSO)[number];

export const ESTADOS_RECURSO = ['Disponible', 'Despachado', 'En Escena', 'Inoperativo'] as const;
export type EstadoRecurso = (typeof ESTADOS_RECURSO)[number];

/** Uso interno de la Mesa de Crisis. Sin coordenadas GPS: nunca se expone al portal público. */
export interface Recurso {
  readonly id: string;
  readonly tipo: TipoRecurso;
  readonly estado_actual: EstadoRecurso;
  readonly incidente_asignado_id: string | null;
  /** Código visible de la unidad (p. ej. "U01"). */
  readonly etiqueta?: string | null;
}

export const TRANSICIONES_RECURSO: Record<EstadoRecurso, readonly EstadoRecurso[]> = {
  Disponible: ['Despachado', 'Inoperativo'],
  Despachado: ['En Escena', 'Disponible', 'Inoperativo'],
  'En Escena': ['Disponible', 'Inoperativo'],
  Inoperativo: ['Disponible'],
};

export function puedeTransicionar(desde: EstadoRecurso, hacia: EstadoRecurso): boolean {
  return TRANSICIONES_RECURSO[desde].includes(hacia);
}

/** Aplica una transición validada sin mutar. Despachar exige `incidenteId`. */
export function transicionarRecurso(
  recurso: Recurso,
  hacia: EstadoRecurso,
  incidenteId?: string,
): Recurso {
  if (!puedeTransicionar(recurso.estado_actual, hacia)) {
    throw new Error(`Transición inválida: ${recurso.estado_actual} → ${hacia}`);
  }
  if (hacia === 'Despachado') {
    if (!incidenteId) throw new Error('Despachar un recurso exige un incidente asignado');
    return { ...recurso, estado_actual: hacia, incidente_asignado_id: incidenteId };
  }
  const conserva = hacia === 'En Escena';
  return {
    ...recurso,
    estado_actual: hacia,
    incidente_asignado_id: conserva ? recurso.incidente_asignado_id : null,
  };
}
