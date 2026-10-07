import type { ReactNode } from 'react';
import { cx } from '../cx';
import './Masthead.css';

export interface MastheadProps {
  kicker?: string;
  title?: string;
  actions?: ReactNode;
  className?: string;
}

/** Cabecera del panel: en Carbón se hunde a carbon-950 para no deslumbrar. */
export function Masthead({ kicker = 'ARGOS', title = 'Mesa de Crisis', actions, className }: MastheadProps) {
  return (
    <header className={cx('ag-masthead', className)}>
      <div className="ag-masthead__brand">
        <span className="ag-masthead__kicker">
          <i aria-hidden="true">■ </i>
          {kicker}
        </span>
        <h1 className="ag-masthead__title">{title}</h1>
      </div>
      {actions ? <div className="ag-masthead__actions">{actions}</div> : null}
    </header>
  );
}
