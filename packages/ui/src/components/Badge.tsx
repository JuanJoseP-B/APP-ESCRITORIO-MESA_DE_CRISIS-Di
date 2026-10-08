import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Glyph, type FormaGlifo } from './Glyph';
import './Badge.css';

export type SeveridadBadge = 'critico' | 'alto' | 'medio' | 'bajo';
export type EstadoIncidenteBadge = 'abierto' | 'contenido' | 'resuelto';
export type TonoBadge = 'critical' | 'warning' | 'success' | 'info' | 'neutral';
export type EnfasisBadge = 'solid' | 'tint' | 'outline';

interface Preset {
  tone: TonoBadge;
  emphasis: EnfasisBadge;
  label: string;
  shape: FormaGlifo;
}

const FORMA_POR_TONO: Record<TonoBadge, FormaGlifo> = {
  critical: 'square',
  warning: 'triangle',
  success: 'circle',
  info: 'diamond',
  neutral: 'ring',
};

export const SEVERIDADES: Record<SeveridadBadge, Preset> = {
  critico: { tone: 'critical', emphasis: 'solid', label: 'Crítico', shape: 'square' },
  alto: { tone: 'critical', emphasis: 'tint', label: 'Alto', shape: 'square' },
  medio: { tone: 'warning', emphasis: 'tint', label: 'Medio', shape: 'triangle' },
  bajo: { tone: 'neutral', emphasis: 'outline', label: 'Bajo', shape: 'ring' },
};

const ESTADOS_INCIDENTE: Record<EstadoIncidenteBadge, Preset> = {
  abierto: { tone: 'info', emphasis: 'tint', label: 'Abierto', shape: 'diamond' },
  contenido: { tone: 'warning', emphasis: 'tint', label: 'Contenido', shape: 'triangle' },
  resuelto: { tone: 'success', emphasis: 'tint', label: 'Resuelto', shape: 'circle' },
};

export interface BadgeProps {
  severity?: SeveridadBadge;
  status?: EstadoIncidenteBadge;
  tone?: TonoBadge;
  emphasis?: EnfasisBadge;
  glyph?: FormaGlifo | false;
  className?: string;
  children?: ReactNode;
}

/** Todo estado = color + glifo + palabra. */
export function Badge({ severity, status, tone, emphasis, glyph, className, children }: BadgeProps) {
  const preset = (severity && SEVERIDADES[severity]) || (status && ESTADOS_INCIDENTE[status]) || undefined;
  const t = tone ?? preset?.tone ?? 'neutral';
  const e = emphasis ?? preset?.emphasis ?? 'tint';
  const forma = glyph === false ? null : (glyph ?? preset?.shape ?? FORMA_POR_TONO[t]);
  return (
    <span className={cx('ag-badge', `ag-badge--${t}`, `ag-badge--${e}`, className)}>
      {forma ? <Glyph shape={forma} /> : null}
      {children ?? preset?.label}
    </span>
  );
}
