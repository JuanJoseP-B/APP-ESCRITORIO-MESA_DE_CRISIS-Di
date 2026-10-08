import type { Coordenadas, EstadoRecurso, Recurso, TipoRecurso } from '@argos/shared';
import { indicativosDe } from './unidades';

/** Lo que el mapa necesita para dibujar una unidad: sin lógica de despacho. */
export interface UnidadMapa {
  readonly id: string;
  readonly indicativo: string;
  readonly tipo: TipoRecurso;
  readonly estado: EstadoRecurso;
  /** Incidente al que está asignada; `null` si está libre. */
  readonly incidenteId: string | null;
  readonly posicion: Coordenadas;
  /** INOPERATIVO: se dibuja atenuada. */
  readonly atenuada: boolean;
}

/**
 * Unidades con posición conocida. `posiciones` (p. ej. la interpolada de una unidad en ruta) manda sobre la
 * `ubicacion` guardada, y esta sobre la `base`; sin ninguna de las tres la unidad no se pinta.
 */
export function unidadesParaMapa(
  recursos: readonly Recurso[],
  posiciones: ReadonlyMap<string, Coordenadas> = new Map(),
): readonly UnidadMapa[] {
  const indicativos = indicativosDe(recursos);
  const unidades: UnidadMapa[] = [];
  for (const r of recursos) {
    const posicion = posiciones.get(r.id) ?? r.ubicacion ?? r.base ?? null;
    if (!posicion) continue;
    unidades.push({
      id: r.id,
      indicativo: indicativos.get(r.id) ?? r.id,
      tipo: r.tipo,
      estado: r.estado_actual,
      incidenteId: r.incidente_asignado_id,
      posicion,
      atenuada: r.estado_actual === 'INOPERATIVO',
    });
  }
  return unidades;
}
