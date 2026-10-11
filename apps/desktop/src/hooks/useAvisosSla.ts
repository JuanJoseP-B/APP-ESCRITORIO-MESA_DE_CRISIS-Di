import { useCallback, useEffect, useRef, useState } from 'react';
import { vencimientosNuevos } from '../domain/sla';

export interface AvisoSla {
  readonly id: number;
  /** Unidad cuyo SLA acaba de vencer. */
  readonly recursoId: string;
}

/** Cuánto se queda un aviso suelto en pantalla antes de retirarse solo. */
export const DURACION_AVISO_SLA_MS = 8000;

/** Con tantos avisos a la vez dejan de ser sueltos: se agrupan en uno solo. */
export const UMBRAL_AVISOS_AGRUPADOS = 3;

interface EstadoAvisos {
  readonly avisos: readonly AvisoSla[];
  readonly agrupado: boolean;
}

const SIN_AVISOS: EstadoAvisos = { avisos: [], agrupado: false };

/**
 * Un aviso por cada vencimiento nuevo: compara las unidades vencidas con las del momento anterior (la primera
 * lectura es la base y no avisa). Un aviso suelto se retira solo a los 8 s o a mano. Si coinciden
 * `UMBRAL_AVISOS_AGRUPADOS` o más, pasan a un único aviso agrupado que dura hasta que el operador lo descarta
 * (`descartarTodos`): ningún temporizador lo retira y los vencimientos posteriores se suman a él.
 */
export function useAvisosSla(vencidas: readonly string[], duracionMs = DURACION_AVISO_SLA_MS) {
  const [estado, setEstado] = useState<EstadoAvisos>(SIN_AVISOS);
  // Espejo síncrono del estado: los temporizadores y el efecto deciden con lo último sin esperar al render.
  const actual = useRef<EstadoAvisos>(SIN_AVISOS);
  const previas = useRef<ReadonlySet<string> | null>(null);
  const contador = useRef(0);
  const temporizadores = useRef(new Set<ReturnType<typeof setTimeout>>());

  const publicar = useCallback((siguiente: EstadoAvisos) => {
    actual.current = siguiente;
    setEstado(siguiente);
  }, []);
  const limpiarTemporizadores = useCallback(() => {
    for (const temporizador of temporizadores.current) clearTimeout(temporizador);
    temporizadores.current.clear();
  }, []);

  const descartar = useCallback(
    (id: number) => publicar({ ...actual.current, avisos: actual.current.avisos.filter((a) => a.id !== id) }),
    [publicar],
  );
  const descartarTodos = useCallback(() => {
    limpiarTemporizadores();
    publicar(SIN_AVISOS);
  }, [limpiarTemporizadores, publicar]);

  useEffect(() => {
    const antes = previas.current;
    previas.current = new Set(vencidas);
    if (antes === null) return;
    const nuevos = vencimientosNuevos(antes, vencidas);
    if (nuevos.length === 0) return;
    const creados = nuevos.map((recursoId): AvisoSla => ({ id: ++contador.current, recursoId }));
    const todos = [...actual.current.avisos, ...creados];
    if (actual.current.agrupado || todos.length >= UMBRAL_AVISOS_AGRUPADOS) {
      // Al agruparse, los temporizadores de los avisos sueltos ya no tienen sentido.
      limpiarTemporizadores();
      publicar({ avisos: todos, agrupado: true });
      return;
    }
    publicar({ avisos: todos, agrupado: false });
    for (const aviso of creados) {
      const temporizador = setTimeout(() => {
        temporizadores.current.delete(temporizador);
        descartar(aviso.id);
      }, duracionMs);
      temporizadores.current.add(temporizador);
    }
  }, [vencidas, duracionMs, descartar, limpiarTemporizadores, publicar]);

  useEffect(() => limpiarTemporizadores, [limpiarTemporizadores]);

  return { avisos: estado.avisos, agrupado: estado.agrupado, descartar, descartarTodos };
}
