import { useId, type SelectHTMLAttributes } from 'react';
import { cx } from '../cx';
import { Glyph } from './Glyph';
import './TextField.css';
import './SelectField.css';

export interface OpcionSelect {
  readonly value: string;
  readonly label: string;
}

export interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  label: string;
  options: readonly OpcionSelect[];
  /** Texto de la opción vacía; sin él no hay opción vacía. */
  placeholder?: string;
  hint?: string;
  error?: string;
  size?: 'md' | 'lg';
}

/** Lista desplegable nativa con el aspecto de `TextField` (misma etiqueta, foco y error). */
export function SelectField({ label, options, placeholder, hint, error, size = 'lg', className, id, disabled, ...resto }: SelectFieldProps) {
  const auto = useId();
  const campoId = id ?? auto;
  const hintId = `${campoId}-hint`;
  const errId = `${campoId}-err`;
  const descrito = [error ? errId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('ag-field', size === 'md' && 'ag-field--md', error && 'ag-field--error', disabled && 'ag-field--disabled', className)}>
      <label className="ag-field__label" htmlFor={campoId}>
        {label}
      </label>
      <div className="ag-field__control">
        <select
          {...resto}
          id={campoId}
          disabled={disabled}
          className="ag-field__input ag-field__input--select"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={descrito}
        >
          {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      {error ? (
        <span className="ag-field__error" id={errId} role="alert">
          <Glyph shape="square" />
          {error}
        </span>
      ) : null}
      {hint && !error ? (
        <span className="ag-field__hint" id={hintId}>
          {hint}
        </span>
      ) : null}
    </div>
  );
}
