import type { ReactNode } from 'react';
import { cx } from '../cx';
import './Kbd.css';

export interface KbdProps {
  /** La tecla, tal como se pulsa: "D", "Esc", "Ctrl+Enter". */
  children: ReactNode;
  /** Solo ayuda visual (por defecto): se oculta a los lectores de pantalla. Con `false` la tecla se lee. */
  decorative?: boolean;
  className?: string;
}

/**
 * Tecla de atajo junto a la acción que dispara. Por defecto es una ayuda visual y se oculta a los lectores de
 * pantalla: el botón anuncia su atajo con `aria-keyshortcuts`, para no ensuciar su nombre accesible. En una hoja
 * de atajos, donde la tecla es el contenido, se usa con `decorative={false}`.
 */
export function Kbd({ children, decorative = true, className }: KbdProps) {
  return (
    <kbd aria-hidden={decorative ? 'true' : undefined} className={cx('ag-kbd', className)}>
      {children}
    </kbd>
  );
}
