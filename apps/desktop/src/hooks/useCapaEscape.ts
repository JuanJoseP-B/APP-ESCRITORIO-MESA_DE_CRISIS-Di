import { useEffect, useRef } from 'react';

/** Capas abiertas que cierran con Esc, de la más antigua a la más reciente (la última es la de arriba). */
const capas: symbol[] = [];

/** `true` mientras haya alguna capa (diálogo, formulario…) que consuma Esc. */
export const hayCapaEscape = (): boolean => capas.length > 0;

/**
 * Una capa de la interfaz que se cierra con Esc (despacho, confirmación del asesor, formulario de llamada). Con
 * varias abiertas, Esc cierra solo la de arriba (la última montada) y no llega a los atajos globales: `useAtajos`
 * ignora Esc mientras exista alguna capa, así que el orden en que se registraron los listeners da igual.
 * `onCerrar` puede cambiar en cada render: se lee desde una ref y el listener se registra una sola vez.
 */
export function useCapaEscape(onCerrar: () => void): void {
  const cerrar = useRef(onCerrar);
  cerrar.current = onCerrar;

  useEffect(() => {
    const id = Symbol('capa-escape');
    capas.push(id);
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || capas[capas.length - 1] !== id) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      cerrar.current();
    };
    document.addEventListener('keydown', alPulsar);
    return () => {
      document.removeEventListener('keydown', alPulsar);
      const n = capas.indexOf(id);
      if (n >= 0) capas.splice(n, 1);
    };
  }, []);
}
