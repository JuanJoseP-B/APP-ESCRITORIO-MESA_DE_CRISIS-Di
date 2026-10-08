import { useCallback, useEffect, useRef, useState } from 'react';
import { vencimientosNuevos } from '../domain/sla';

export interface AvisoSla {
  readonly id: number;
  /** Unidad cuyo SLA acaba de vencer. */
  readonly recursoId: string;
}

/** Cuánto se queda un aviso en pantalla antes de retirarse solo. */
export const DURACION_AVISO_SLA_MS = 8000;

/**
 * Un aviso por cada vencimiento nuevo: compara las unidades vencidas con las del momento anterior (la primera
 * lectura es la base y no avisa). Cada aviso se retira solo a los 8 s o a mano.
 */
export function useAvisosSla(vencidas: readonly string[], duracionMs = DURACION_AVISO_SLA_MS) {
  const [avisos, setAvisos] = useState<readonly AvisoSla[]>([]);
  const previas = useRef<ReadonlySet<string> | null>(null);
  const contador = useRef(0);
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>());

  const descartar = useCallback((id: number) => setAvisos((actuales) => actuales.filter((a) => a.id !== id)), []);

  useEffect(() => {
    const antes = previas.current;
    previas.current = new Set(vencidas);
    if (antes === null) return;
    const nuevos = vencimientosNuevos(antes, vencidas);
    if (nuevos.length === 0) return;
    const creados = nuevos.map((recursoId): AvisoSla => ({ id: ++contador.current, recursoId }));
    setAvisos((actuales) => [...actuales, ...creados]);
    for (const aviso of creados) {
      const temporizador = setTimeout(() => {
        temporizadores.current.delete(temporizador);
        descartar(aviso.id);
      }, duracionMs);
      temporizadores.current.add(temporizador);
    }
  }, [vencidas, duracionMs, descartar]);

  useEffect(() => {
    const vigentes = temporizadores.current;
    return () => {
      for (const temporizador of vigentes) clearTimeout(temporizador);
      vigentes.clear();
    };
  }, []);

  return { avisos, descartar };
}
