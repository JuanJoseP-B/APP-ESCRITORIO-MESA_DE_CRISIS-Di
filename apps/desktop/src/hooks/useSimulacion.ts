import { useCallback, useEffect, useReducer, useRef } from 'react';
import { agregarEvento } from '@argos/shared';
import { DURACION_ESCENARIO_SEG, GUION_CRISIS, TRAFICO_ESCENARIO, eventosEntre, type Guion } from '../domain/escenario';
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

/**
 * Hace avanzar el escenario del demo: cada `intervaloMs` reales inyecta por el servicio las llamadas del
 * guion que ya tocan según el reloj simulado. Sin `reloj` (backend real) no hace nada y devuelve `null`.
 */
export function useSimulacion(
  servicio: ServicioMesa,
  reloj: RelojSimulado | undefined,
  guion: Guion = GUION_CRISIS,
  intervaloMs = 250,
): EstadoSimulacion | null {
  const [, repintar] = useReducer((n: number) => n + 1, 0);
  const inyectadoHastaSeg = useRef(0);
  const retrasoAnotado = useRef(false);

  useEffect(() => {
    if (!reloj) return;
    const id = setInterval(() => {
      const t = reloj.transcurridoSeg();
      for (const evento of eventosEntre(guion, inyectadoHastaSeg.current, t)) {
        servicio.registrarLlamada(evento.llamada).catch(() => undefined);
      }
      // El retraso por tráfico del escenario queda en la bitácora del incidente, una sola vez.
      if (guion === GUION_CRISIS && !retrasoAnotado.current && t >= TRAFICO_ESCENARIO.tSeg) {
        retrasoAnotado.current = true;
        servicio
          .listarIncidentes()
          .then((incidentes) => {
            const incidente = incidentes.find((i) => i.id === TRAFICO_ESCENARIO.incidenteId);
            if (!incidente) return undefined;
            const timeline = agregarEvento(incidente.timeline, TRAFICO_ESCENARIO.nota, new Date(reloj.ahora()), AUTOR_SISTEMA);
            return servicio.actualizarIncidente(incidente.id, { timeline });
          })
          .catch(() => undefined);
      }
      inyectadoHastaSeg.current = Math.max(inyectadoHastaSeg.current, t);
      repintar();
    }, intervaloMs);
    return () => clearInterval(id);
  }, [servicio, reloj, guion, intervaloMs]);

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
