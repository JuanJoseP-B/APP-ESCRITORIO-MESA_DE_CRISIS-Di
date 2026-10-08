import type { ReactNode } from 'react';
import { cx } from '../cx';
import { Button } from './Button';
import { StatusIndicator, type EstadoRecursoUI } from './StatusIndicator';
import './DispatchRow.css';

export interface DispatchRowProps {
  /** Tipo de recurso, p. ej. "Ambulancia". */
  kind: string;
  /** Código dictable por radio, p. ej. "U02". */
  code: string;
  status: EstadoRecursoUI;
  detail?: string;
  /** Sustituye las acciones por defecto del estado. */
  actions?: ReactNode;
  onDispatch?: () => void;
  onToggleOperative?: () => void;
  onArrive?: () => void;
  onCancel?: () => void;
  onRelease?: () => void;
  className?: string;
}

export function DispatchRow({ kind, code, status, detail, actions, onDispatch, onToggleOperative, onArrive, onCancel, onRelease, className }: DispatchRowProps) {
  const porDefecto: Record<EstadoRecursoUI, ReactNode> = {
    disponible: (
      <>
        <Button variant="primary" size="sm" onClick={onDispatch}>
          Despachar
        </Button>
        <Button size="sm" onClick={onToggleOperative}>
          Inoperativo
        </Button>
      </>
    ),
    despachado: (
      <>
        <Button variant="secondary" size="sm" onClick={onArrive}>
          En escena
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </>
    ),
    enruta: (
      <>
        <Button variant="secondary" size="sm" onClick={onArrive}>
          En escena
        </Button>
        <Button size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </>
    ),
    escena: (
      <Button size="sm" onClick={onRelease}>
        Liberar
      </Button>
    ),
    inoperativo: (
      <Button size="sm" onClick={onToggleOperative}>
        Habilitar
      </Button>
    ),
  };
  return (
    <div className={cx('ag-row', `ag-row--${status}`, className)} role="group" aria-label={`${kind} ${code}`}>
      <StatusIndicator status={status} glyphOnly className="ag-row__glyph" />
      <div className="ag-row__id">
        <span className="ag-row__name">
          {kind}
          <span className="ag-row__code">{code}</span>
        </span>
        {detail ? <span className="ag-row__detail">{detail}</span> : null}
      </div>
      <div className="ag-row__actions">{actions ?? porDefecto[status]}</div>
    </div>
  );
}
