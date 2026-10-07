import type { ReactNode } from 'react';
import { cx } from '../cx';
import './SectionHeader.css';

export interface SectionHeaderProps {
  title: string;
  /** Índice editorial, p. ej. "01". */
  index?: string;
  count?: ReactNode;
  action?: ReactNode;
  as?: 'h2' | 'h3';
  className?: string;
}

/** Filete editorial de 2px + overline numerado ("01 INCIDENTES"). */
export function SectionHeader({ title, index, count, action, as: Etiqueta = 'h2', className }: SectionHeaderProps) {
  return (
    <div className={cx('ag-section', className)}>
      <Etiqueta className="ag-section__title">
        {index ? <span className="ag-section__index">{index}</span> : null}
        <span>{title}</span>
        {count != null ? <span className="ag-section__count">· {count}</span> : null}
      </Etiqueta>
      {action ?? null}
    </div>
  );
}
