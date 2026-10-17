import { useId } from 'react';
import { cx } from '../cx';
import './Switch.css';

export interface SwitchProps {
  /** Lo que activa o apaga; es el nombre accesible. */
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  /** Palabras del estado (p. ej. «Activado»/«Desactivado»): el estado no se comunica solo con color y posición. */
  onLabel: string;
  offLabel: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

/** Interruptor de dos estados con rol `switch`; Espacio o Enter lo alternan. */
export function Switch({ label, checked, onChange, onLabel, offLabel, hint, disabled, className }: SwitchProps) {
  const id = useId();
  const idEtiqueta = `${id}-label`;
  const idAyuda = `${id}-hint`;
  return (
    <div className={cx('ag-switch', disabled && 'ag-switch--disabled', className)}>
      <div className="ag-switch__texto">
        <span id={idEtiqueta} className="ag-switch__label">
          {label}
        </span>
        {hint ? (
          <span id={idAyuda} className="ag-switch__hint">
            {hint}
          </span>
        ) : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={idEtiqueta}
        aria-describedby={hint ? idAyuda : undefined}
        disabled={disabled}
        className="ag-switch__control"
        onClick={() => onChange(!checked)}
      >
        <span aria-hidden="true" className="ag-switch__track">
          <span className="ag-switch__thumb" />
        </span>
        <span className="ag-switch__state">{checked ? onLabel : offLabel}</span>
      </button>
    </div>
  );
}
