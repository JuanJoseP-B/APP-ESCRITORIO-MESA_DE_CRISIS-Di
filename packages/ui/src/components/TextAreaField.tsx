import { useId, type TextareaHTMLAttributes } from 'react';
import { cx } from '../cx';
import { Glyph } from './Glyph';
import './TextField.css';
import './SelectField.css';

export interface TextAreaFieldProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string;
}

/** Área de texto multilínea con el aspecto de `TextField`. */
export function TextAreaField({ label, hint, error, className, id, disabled, rows = 4, ...resto }: TextAreaFieldProps) {
  const auto = useId();
  const campoId = id ?? auto;
  const hintId = `${campoId}-hint`;
  const errId = `${campoId}-err`;
  const descrito = [error ? errId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('ag-field', error && 'ag-field--error', disabled && 'ag-field--disabled', className)}>
      <label className="ag-field__label" htmlFor={campoId}>
        {label}
      </label>
      <div className="ag-field__control">
        <textarea
          {...resto}
          id={campoId}
          rows={rows}
          disabled={disabled}
          className="ag-field__input ag-field__input--area"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={descrito}
        />
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
