import { useCallback, useEffect, useRef, useState } from 'react';

/** Margen para deshacer un descarte antes de aplicarlo. */
export const ESPERA_DESHACER_MS = 5000;

export interface DescarteDiferido<T> {
  /** Elemento descartado que aún se puede recuperar; `null` si no hay ninguno pendiente. */
  readonly pendiente: T | null;
  /** Lo saca de la vista ya y lo confirma pasado el margen; si había otro pendiente, ese se confirma al momento. */
  readonly descartar: (item: T) => void;
  /** Recupera el pendiente: nunca se llega a confirmar. */
  readonly deshacer: () => void;
}

/**
 * Descarte con «Deshacer»: la acción real (`confirmar`) se aplaza `esperaMs`. Mientras tanto la interfaz oculta el
 * elemento y ofrece recuperarlo. Al desmontar, el pendiente se confirma para no perder el descarte.
 */
export function useDescarteDiferido<T>(confirmar: (item: T) => void, esperaMs = ESPERA_DESHACER_MS): DescarteDiferido<T> {
  const [pendiente, setPendiente] = useState<T | null>(null);
  const pendienteRef = useRef<T | null>(null);
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confirmarRef = useRef(confirmar);
  confirmarRef.current = confirmar;

  const limpiar = () => {
    if (temporizador.current !== null) clearTimeout(temporizador.current);
    temporizador.current = null;
  };

  const confirmarPendiente = useCallback(() => {
    const item = pendienteRef.current;
    limpiar();
    if (item === null) return;
    pendienteRef.current = null;
    setPendiente(null);
    confirmarRef.current(item);
  }, []);

  const descartar = useCallback(
    (item: T) => {
      confirmarPendiente();
      pendienteRef.current = item;
      setPendiente(item);
      temporizador.current = setTimeout(confirmarPendiente, esperaMs);
    },
    [confirmarPendiente, esperaMs],
  );

  const deshacer = useCallback(() => {
    limpiar();
    pendienteRef.current = null;
    setPendiente(null);
  }, []);

  useEffect(() => confirmarPendiente, [confirmarPendiente]);

  return { pendiente, descartar, deshacer };
}
