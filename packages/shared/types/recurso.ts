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
}
