import { useMemo } from 'react';
import type { EstadoSla, EventoRecurso, Incidente, Recurso } from '@argos/shared';
import { resumirSla, slaDeRecursos, type ResumenSla } from '../domain/sla';
import { useReloj } from './useReloj';

export interface SlaConsola {
  /** SLA de las unidades con despacho en curso, por id de recurso; las demás no aparecen. */
  readonly porRecurso: ReadonlyMap<string, EstadoSla>;
  readonly resumen: ResumenSla;
}

/**
 * Cronómetros SLA de la consola: se recalculan a 1 Hz sobre el reloj de la consola (`ahora`, el simulado en el
 * demo) sin consultar la base. `desfaseMs` es la diferencia servidor − local.
 */
export function useSla(
  recursos: readonly Recurso[],
  eventos: readonly EventoRecurso[],
  incidentes: readonly Incidente[],
  desfaseMs = 0,
  ahora?: () => number,
  intervaloMs = 1000,
): SlaConsola {
  const hora = useReloj(desfaseMs, intervaloMs, ahora);
  return useMemo(() => {
    const porRecurso = slaDeRecursos(recursos, eventos, incidentes, hora);
    return { porRecurso, resumen: resumirSla(recursos, porRecurso) };
  }, [recursos, eventos, incidentes, hora]);
}
