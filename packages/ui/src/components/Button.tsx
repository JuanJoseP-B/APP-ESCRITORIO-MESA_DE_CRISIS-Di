import type { ButtonHTMLAttributes, ReactNode } from 'react';
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
  ...resto
}: ButtonProps) {
  return (
    <button
      type={type}
      {...resto}
      className={cx('ag-btn', `ag-btn--${variant}`, `ag-btn--${size}`, block && 'ag-btn--block', square && 'ag-btn--square', className)}
    >
      {icon}
      {children}
    </button>
  );
}
