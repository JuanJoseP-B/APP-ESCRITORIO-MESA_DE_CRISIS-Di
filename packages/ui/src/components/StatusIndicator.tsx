import { cx } from '../cx';
import { Glyph, type FormaGlifo } from './Glyph';
import './StatusIndicator.css';

export type EstadoRecursoUI = 'disponible' | 'despachado' | 'escena' | 'inoperativo';

export const ESTADOS_RECURSO_UI: Record<EstadoRecursoUI, { label: string; shape: FormaGlifo }> = {
  disponible: { label: 'Disponible', shape: 'circle' },
  despachado: { label: 'Despachado', shape: 'triangle' },
  escena: { label: 'En escena', shape: 'diamond' },
  inoperativo: { label: 'Inoperativo', shape: 'ring' },
};

export interface StatusIndicatorProps {
  status: EstadoRecursoUI;
  count?: number;
  label?: string;
  /** Solo el glifo; la palabra queda para lectores de pantalla. */
  glyphOnly?: boolean;
  className?: string;
}

export function StatusIndicator({ status, count, label, glyphOnly, className }: StatusIndicatorProps) {
  const estado = ESTADOS_RECURSO_UI[status];
  return (
    <span className={cx('ag-status', `ag-status--${status}`, className)}>
      <Glyph shape={estado.shape} />
      {glyphOnly ? <span className="ag-sr-only">{estado.label}</span> : (label ?? estado.label)}
      {count != null && !glyphOnly ? <span className="ag-status__count">({count})</span> : null}
    </span>
  );
}
