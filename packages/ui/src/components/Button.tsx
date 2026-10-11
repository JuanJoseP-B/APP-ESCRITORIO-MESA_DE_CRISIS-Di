import { useState, type ButtonHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { cx } from '../cx';
import './Button.css';

export type VarianteBoton = 'primary' | 'secondary' | 'ghost' | 'danger' | 'inverse';
export type TamanoControl = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: VarianteBoton;
  size?: TamanoControl;
  block?: boolean;
  square?: boolean;
  icon?: ReactNode;
}

/** Máximo un `primary` por vista/fila: el naranja significa "acción posible". */
export function Button({
  variant = 'ghost',
  size = 'md',
  block,
  square,
  icon,
  className,
  children,
  type = 'button',
  disabled,
  onKeyDown,
  onKeyUp,
  onBlur,
  onMouseLeave,
  ...resto
}: ButtonProps) {
  // `:active` no se activa con el teclado: data-pressed da el mismo feedback de presión mecánica.
  const [presionado, setPresionado] = useState(false);
  const inactivo = disabled || resto['aria-disabled'] === true || resto['aria-disabled'] === 'true';
  const alPulsarTecla = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!inactivo && (e.key === 'Enter' || e.key === ' ')) setPresionado(true);
    onKeyDown?.(e);
  };
  return (
    <button
      type={type}
      {...resto}
      disabled={disabled}
      data-pressed={presionado && !inactivo ? 'true' : undefined}
      onKeyDown={alPulsarTecla}
      onKeyUp={(e) => { setPresionado(false); onKeyUp?.(e); }}
      onBlur={(e) => { setPresionado(false); onBlur?.(e); }}
      onMouseLeave={(e) => { setPresionado(false); onMouseLeave?.(e); }}
      className={cx('ag-btn', `ag-btn--${variant}`, `ag-btn--${size}`, block && 'ag-btn--block', square && 'ag-btn--square', className)}
    >
      {icon}
      {children}
    </button>
  );
}
