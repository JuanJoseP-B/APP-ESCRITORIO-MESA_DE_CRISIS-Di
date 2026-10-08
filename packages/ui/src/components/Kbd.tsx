import type { ReactNode } from 'react';
import { cx } from '../cx';
import './Kbd.css';

export interface KbdProps {
  /** La tecla, tal como se pulsa: "D", "Esc", "Ctrl+Enter". */
  children: ReactNode;
  className?: string;
}

/**
 * Tecla de atajo junto a la acción que dispara. Es una ayuda visual y se oculta a los lectores de pantalla: el
 * botón anuncia su atajo con `aria-keyshortcuts`, para no ensuciar su nombre accesible.
 */
export function Kbd({ children, className }: KbdProps) {
  return (
    <kbd aria-hidden="true" className={cx('ag-kbd', className)}>
      {children}
    </kbd>
  );
}
