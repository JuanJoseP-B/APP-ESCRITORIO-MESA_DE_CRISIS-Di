import { useCallback, useEffect, useReducer, useRef } from 'react';
import { agregarEvento } from '@argos/shared';
import { DURACION_ESCENARIO_SEG, ESCENARIOS, eventosEntre, type Escenario } from '../domain/escenario';
import type { RelojSimulado, Velocidad } from '../domain/relojSimulado';
import type { ServicioMesa } from '../services/supabaseClient';
import { AUTOR_SISTEMA } from './useLlegadaUnidades';

export interface EstadoSimulacion {
  readonly reproduciendo: boolean;
  readonly velocidad: Velocidad;
  /** Segundos del escenario transcurridos, acotados a la duración. */
  readonly tSeg: number;
  readonly duracionSeg: number;
  alternar(): void;
  fijarVelocidad(velocidad: Velocidad): void;
}

/** Lo que la simulación necesita del escenario: su guion y la unidad retenida. */
export type GuionSimulado = Pick<Escenario, 'guion' | 'retraso'>;

/**
 * Hace avanzar el escenario del demo: cada `intervaloMs` reales inyecta por el servicio las llamadas del
 * guion que ya tocan según el reloj simulado. Sin `reloj` (backend real) no hace nada y devuelve `null`.
 */
export function useSimulacion(
  servicio: ServicioMesa,
  reloj: RelojSimulado | undefined,
  escenario: GuionSimulado = ESCENARIOS.A,
  intervaloMs = 250,
): EstadoSimulacion | null {
  const [, repintar] = useReducer((n: number) => n + 1, 0);
  const inyectadoHastaSeg = useRef(0);
  const retrasoAnotado = useRef(false);
  const { guion, retraso } = escenario;

  useEffect(() => {
    if (!reloj) return;
    let buscandoRetraso = false;
    const id = setInterval(() => {
      const t = reloj.transcurridoSeg();
      for (const evento of eventosEntre(guion, inyectadoHastaSeg.current, t)) {
        servicio.registrarLlamada(evento.llamada).catch(() => undefined);
      }
      // El retraso de la unidad retenida queda en la bitácora del incidente al que va, una sola vez y en cuanto sale.
      if (retraso && !retrasoAnotado.current && !buscandoRetraso && t >= retraso.tSeg) {
        buscandoRetraso = true;
        Promise.all([servicio.listarRecursos(), servicio.listarIncidentes()])
          .then(([recursos, incidentes]) => {
            const unidad = recursos.find((r) => r.etiqueta === retraso.etiqueta && r.estado_actual === 'EN_RUTA');
            const incidente = incidentes.find((i) => i.id === unidad?.incidente_asignado_id);
            if (retrasoAnotado.current || !incidente) return undefined;
            retrasoAnotado.current = true;
            const timeline = agregarEvento(incidente.timeline, retraso.nota, new Date(reloj.ahora()), AUTOR_SISTEMA);
            return servicio.actualizarIncidente(incidente.id, { timeline });
          })
          .catch(() => undefined)
          .finally(() => {
            buscandoRetraso = false;
          });
      }
      inyectadoHastaSeg.current = Math.max(inyectadoHastaSeg.current, t);
      repintar();
    }, intervaloMs);
    return () => clearInterval(id);
  }, [servicio, reloj, guion, retraso, intervaloMs]);

  const alternar = useCallback(() => {
    if (!reloj) return;
    if (reloj.reproduciendo) reloj.pausar();
    else reloj.reproducir();
    repintar();
  }, [reloj]);

  const fijarVelocidad = useCallback(
    (velocidad: Velocidad) => {
      reloj?.fijarVelocidad(velocidad);
      repintar();
    },
    [reloj],
  );

  if (!reloj) return null;
  return {
    reproduciendo: reloj.reproduciendo,
    velocidad: reloj.velocidad,
    tSeg: Math.min(reloj.transcurridoSeg(), DURACION_ESCENARIO_SEG),
    duracionSeg: DURACION_ESCENARIO_SEG,
    alternar,
    fijarVelocidad,
  };
}
