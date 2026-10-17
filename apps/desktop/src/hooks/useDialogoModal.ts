import { useEffect, type KeyboardEvent, type RefObject } from 'react';

const FOCALIZABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Comportamiento común de los diálogos modales de la consola: al abrir, el foco entra en el elemento marcado con
 * `data-foco-inicial`; Tab y Shift+Tab dan la vuelta sin salir; Esc cierra; y al cerrar el foco vuelve a quien
 * lo tenía. Devuelve el `onKeyDown` que se pone en el diálogo. Mientras está abierto, el teclado no llega a los
 * atajos globales (la pulsación no sube más allá del diálogo), salvo lo que `teclasDeCierre` indique.
 */
export function useDialogoModal(
  panel: RefObject<HTMLElement | null>,
  onCerrar: () => void,
  teclasDeCierre: readonly string[] = [],
): (e: KeyboardEvent<HTMLElement>) => void {
  useEffect(() => {
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();
    return () => {
      if (opener?.isConnected) opener.focus();
    };
  }, [panel]);

  return (e) => {
    e.stopPropagation();
    if (e.key === 'Escape' || teclasDeCierre.includes(e.key)) {
      e.preventDefault();
      onCerrar();
      return;
    }
    if (e.key !== 'Tab' || !panel.current) return;
    const enfocables = [...panel.current.querySelectorAll<HTMLElement>(FOCALIZABLES)];
    const primero = enfocables[0];
    const ultimo = enfocables[enfocables.length - 1];
    if (!primero || !ultimo) return;
    if (!panel.current.contains(document.activeElement)) {
      e.preventDefault();
      primero.focus();
    } else if (e.shiftKey && document.activeElement === primero) {
      e.preventDefault();
      ultimo.focus();
    } else if (!e.shiftKey && document.activeElement === ultimo) {
      e.preventDefault();
      primero.focus();
    }
  };
}
