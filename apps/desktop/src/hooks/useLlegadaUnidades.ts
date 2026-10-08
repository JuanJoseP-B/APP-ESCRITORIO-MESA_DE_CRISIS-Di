import { useEffect, useRef } from 'react';
import { agregarEvento, type EventoRecurso, type EventoTimeline, type Incidente, type Recurso } from '@argos/shared';
import type { RetrasoUnidad } from '../domain/escenario';
import { movimientosEnRuta } from '../domain/movimiento';
import type { RelojSimulado } from '../domain/relojSimulado';
import { indicativosDe } from '../domain/unidades';
import type { ServicioMesa } from '../services/supabaseClient';

interface Opciones {
  readonly servicio: ServicioMesa;
  /** Solo el demo tiene reloj simulado; sin él (backend real) las unidades no llegan solas. */
  readonly reloj: RelojSimulado | undefined;
  readonly recursos: readonly Recurso[];
  readonly eventos: readonly EventoRecurso[];
  readonly incidentes: readonly Incidente[];
  /** Unidad retenida del escenario activo; si se omite, la del escenario A. */
  readonly retraso?: RetrasoUnidad | null;
  readonly intervaloMs?: number;
}

/** Autor de lo que anota la consola por su cuenta en la bitácora. */
export const AUTOR_SISTEMA = 'Sistema';

/**
 * Cuando una unidad EN_RUTA completa su trayecto, pasa sola a EN_ESCENA y lo deja en la bitácora del incidente.
 * Comprueba cada `intervaloMs` reales contra el reloj simulado, así que en pausa no llega nadie.
 */
export function useLlegadaUnidades({ servicio, reloj, recursos, eventos, incidentes, retraso, intervaloMs = 250 }: Opciones): void {
  const vigentes = useRef({ recursos, eventos, incidentes });
  vigentes.current = { recursos, eventos, incidentes };
  // Unidades ya enviadas a EN_ESCENA que el estado local aún muestra EN_RUTA: evita llegar dos veces.
  const enCurso = useRef(new Set<string>());

  useEffect(() => {
    if (!reloj) return;
    const id = setInterval(() => {
      const { recursos: rs, eventos: evs, incidentes: incs } = vigentes.current;
      for (const rid of enCurso.current) {
        if (rs.find((r) => r.id === rid)?.estado_actual !== 'EN_RUTA') enCurso.current.delete(rid);
      }
      const ahoraMs = reloj.ahora();
      const llegadas = movimientosEnRuta(rs, evs, incs, ahoraMs, undefined, retraso).filter((m) => m.llego && !enCurso.current.has(m.recursoId));
      if (llegadas.length === 0) return;
      const indicativos = indicativosDe(rs);
      const notas = new Map<string, readonly EventoTimeline[]>();
      for (const m of llegadas) {
        enCurso.current.add(m.recursoId);
        servicio.cambiarEstadoRecurso(m.recursoId, 'EN_ESCENA', m.incidenteId, 'SISTEMA').catch(() => enCurso.current.delete(m.recursoId));
        const incidente = incs.find((i) => i.id === m.incidenteId);
        if (!incidente) continue;
        const nombre = indicativos.get(m.recursoId) ?? m.recursoId;
        notas.set(
          incidente.id,
          agregarEvento(notas.get(incidente.id) ?? incidente.timeline, `Unidad ${nombre} llegó a la escena`, new Date(ahoraMs), AUTOR_SISTEMA),
        );
      }
      for (const [incidenteId, timeline] of notas) servicio.actualizarIncidente(incidenteId, { timeline }).catch(() => undefined);
    }, intervaloMs);
    return () => clearInterval(id);
  }, [servicio, reloj, retraso, intervaloMs]);
}
