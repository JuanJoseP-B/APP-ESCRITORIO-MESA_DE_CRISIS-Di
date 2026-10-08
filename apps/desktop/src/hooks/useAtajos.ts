import { useEffect, useRef } from 'react';
import { resolverAtajo, type MapaAtajos } from '../domain/atajos';

export type { MapaAtajos };

/**
 * Atajos globales de la consola (ROADMAP_CAD §2.3). Se desactivan dentro de campos de texto salvo
 * Esc y Ctrl+Enter. El mapa puede cambiar en cada render: se lee desde una ref y el listener se
 * registra una sola vez.
 */
export function useAtajos(mapa: MapaAtajos, activo = true): void {
  const mapaActual = useRef(mapa);
  mapaActual.current = mapa;

  useEffect(() => {
    if (!activo) return;
    const alPulsar = (e: KeyboardEvent) => {
      const accion = resolverAtajo(mapaActual.current, e, e.target);
      if (accion === null) return;
      e.preventDefault();
      accion();
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [activo]);
}
