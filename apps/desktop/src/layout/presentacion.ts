import type { EstadoIncidente, EstadoRecurso, NivelCriticidad } from '@argos/shared';
import type { EstadoIncidenteBadge, EstadoRecursoUI, SeveridadBadge } from '@argos/ui';

/** Correspondencias entre el dominio y las variantes de `@argos/ui` que comparten los paneles. */
export const SEVERIDAD_UI: Readonly<Record<NivelCriticidad, SeveridadBadge>> = {
  Crítico: 'critico',
  Medio: 'medio',
  Bajo: 'bajo',
};

export const ESTADO_INCIDENTE_UI: Readonly<Record<EstadoIncidente, EstadoIncidenteBadge>> = {
  Abierto: 'abierto',
  Contenido: 'contenido',
  Resuelto: 'resuelto',
};

export const ESTADO_RECURSO_UI: Readonly<Record<EstadoRecurso, EstadoRecursoUI>> = {
  Disponible: 'disponible',
  Despachado: 'despachado',
  'En Escena': 'escena',
  Inoperativo: 'inoperativo',
};
