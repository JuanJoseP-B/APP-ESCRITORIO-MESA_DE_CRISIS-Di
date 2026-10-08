import { useId, type ReactNode } from 'react';
import { cx } from '../cx';
import './RailColapsable.css';

export interface RailColapsableProps {
  /** Nombre del panel; rotulado en el rail y usado como nombre accesible. */
  label: string;
  /** Borde donde se ancla el panel: define hacia dónde apunta la flecha. */
  side: 'left' | 'right';
  collapsed: boolean;
  onToggle: () => void;
  /** Contenido del rail plegado (p. ej. un icono); si falta, solo se ve el rótulo vertical. */
  icon?: ReactNode;
  /** Tecla que alterna el panel, p. ej. "[" ; se muestra como ayuda. */
  shortcut?: string;
  children: ReactNode;
  className?: string;
}

/** Panel lateral de la grilla: expandido muestra su contenido y plegado queda en un rail de 40 px. */
export function RailColapsable({ label, side, collapsed, onToggle, icon, shortcut, children, className }: RailColapsableProps) {
  const idCuerpo = useId();
  const flecha = (side === 'left') === collapsed ? '»' : '«';
  const accion = collapsed ? 'Expandir' : 'Colapsar';
  return (
    <section
      className={cx('ag-rail', className)}
      data-colapsado={collapsed ? 'true' : 'false'}
      data-lado={side}
      aria-label={label}
    >
      <button
        type="button"
        className="ag-rail__toggle"
        aria-label={`${accion} ${label}`}
        aria-expanded={!collapsed}
        aria-controls={idCuerpo}
        aria-keyshortcuts={shortcut}
        title={shortcut ? `${accion} ${label} (${shortcut})` : `${accion} ${label}`}
        onClick={onToggle}
      >
        <span aria-hidden="true" className="ag-rail__arrow">
          {flecha}
        </span>
        {collapsed ? (
          <>
            {icon ? <span className="ag-rail__icon">{icon}</span> : null}
            <span className="ag-rail__label">{label}</span>
          </>
        ) : null}
      </button>
      <div id={idCuerpo} className="ag-rail__body" hidden={collapsed}>
        {children}
      </div>
    </section>
  );
}
