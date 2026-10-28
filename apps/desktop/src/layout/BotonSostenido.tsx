import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { useTexto } from '../i18n/IdiomaProvider';

/** Cuánto hay que mantener pulsado para confirmar. */
export const SOSTENER_MS = 700;

export interface BotonSostenidoProps {
  readonly onConfirmar: () => void;
  /** Nombre accesible (p. ej. «Marcar Resuelto»). */
  readonly ariaLabel: string;
  readonly children: ReactNode;
  readonly duracionMs?: number;
  readonly className?: string;
}

const TECLAS = new Set([' ', 'Enter']);

/**
 * Acción que pide confirmación física: un relleno crece de izquierda a derecha mientras se mantiene pulsado (ratón,
 * táctil, Espacio o Enter) y la acción se ejecuta al completarse; si se suelta antes, se cancela y el relleno vuelve.
 */
export function BotonSostenido({ onConfirmar, ariaLabel, children, duracionMs = SOSTENER_MS, className }: BotonSostenidoProps) {
  const { t } = useTexto();
  const idAyuda = useId();
  const [cargando, setCargando] = useState(false);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmarRef = useRef(onConfirmar);
  confirmarRef.current = onConfirmar;

  const cancelar = () => {
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = null;
    setCargando(false);
  };
  const empezar = () => {
    if (temporizador.current !== null) return;
    setCargando(true);
    temporizador.current = setTimeout(() => {
      temporizador.current = null;
      setCargando(false);
      confirmarRef.current();
    }, duracionMs);
  };
  useEffect(() => () => {
    if (temporizador.current !== null) clearTimeout(temporizador.current);
  }, []);

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      aria-describedby={idAyuda}
      data-cargando={cargando || undefined}
      className={`ag-sostenido ${className ?? ''}`.trim()}
      style={{ ['--ag-sostener' as string]: `${duracionMs}ms` }}
      onPointerDown={(e: PointerEvent<HTMLButtonElement>) => {
        if (e.button !== 0) return;
        empezar();
      }}
      onPointerUp={cancelar}
      onPointerLeave={cancelar}
      onPointerCancel={cancelar}
      onKeyDown={(e: KeyboardEvent<HTMLButtonElement>) => {
        if (!TECLAS.has(e.key)) return;
        e.preventDefault();
        if (!e.repeat) empezar();
      }}
      onKeyUp={(e: KeyboardEvent<HTMLButtonElement>) => {
        if (TECLAS.has(e.key)) cancelar();
      }}
      onBlur={cancelar}
      onClick={(e) => e.preventDefault()}
    >
      <span aria-hidden="true" className="ag-sostenido__relleno" />
      <span className="relative">{children}</span>
      <span id={idAyuda} hidden>
        {t('sostener.ayuda')}
      </span>
    </button>
  );
}
