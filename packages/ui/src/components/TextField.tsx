import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { cx } from '../cx';
import { Glyph } from './Glyph';
import './TextField.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label: string;
  hint?: string;
  error?: string;
  size?: 'md' | 'lg';
  mono?: boolean;
  trailing?: ReactNode;
}

export function TextField({ label, hint, error, size = 'lg', mono, trailing, className, id, disabled, ...resto }: TextFieldProps) {
  const auto = useId();
  const campoId = id ?? auto;
  const hintId = `${campoId}-hint`;
  const errId = `${campoId}-err`;
  const descrito = [error ? errId : null, hint && !error ? hintId : null].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('ag-field', size === 'md' && 'ag-field--md', mono && 'ag-field--mono', error && 'ag-field--error', disabled && 'ag-field--disabled', className)}>
      <label className="ag-field__label" htmlFor={campoId}>
        {label}
      </label>
      <div className="ag-field__control">
        <input
          {...resto}
          id={campoId}
          disabled={disabled}
          className="ag-field__input"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={descrito}
        />
        {trailing ? <span className="ag-field__adorn">{trailing}</span> : null}
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
