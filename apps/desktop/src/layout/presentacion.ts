import type { EstadoIncidente, EstadoRecurso, NivelCriticidad, Prioridad } from '@argos/shared';
import type { EnfasisBadge, EstadoIncidenteBadge, EstadoRecursoUI, SeveridadBadge, TonoBadge } from '@argos/ui';

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
  DISPONIBLE: 'disponible',
  ASIGNADO: 'despachado',
  EN_RUTA: 'enruta',
  EN_ESCENA: 'escena',
  INOPERATIVO: 'inoperativo',
};

/** P1 (riesgo vital) es el único en rojo; el resto baja de intensidad. Siempre se muestra con glifo y palabra. */
export const PRIORIDAD_UI: Readonly<Record<Prioridad, { readonly tone: TonoBadge; readonly emphasis: EnfasisBadge }>> = {
  P1: { tone: 'critical', emphasis: 'solid' },
  P2: { tone: 'warning', emphasis: 'tint' },
  P3: { tone: 'info', emphasis: 'tint' },
  P4: { tone: 'neutral', emphasis: 'outline' },
};
