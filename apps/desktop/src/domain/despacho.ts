import type { Coordenadas, Incidente, Recurso } from '@argos/shared';
import { distanciaM, ubicacionDeIncidente } from './geo';
import { indicativosDe } from './unidades';

/** Una unidad libre que puede despacharse al incidente, con lo lejos que está. */
export interface CandidataDespacho {
  readonly recurso: Recurso;
  readonly indicativo: string;
  /** Metros en línea recta hasta el incidente; `null` si la unidad no tiene posición conocida. */
  readonly distanciaM: number | null;
}

const posicionDe = (r: Recurso): Coordenadas | null => r.ubicacion ?? r.base ?? null;

/**
 * Unidades DISPONIBLES ordenadas de la más cercana a la más lejana al incidente; las que no tienen posición van al
 * final (por indicativo). La primera es la sugerida: la que el diálogo de despacho deja preseleccionada.
 */
export function candidatasDeDespacho(recursos: readonly Recurso[], incidente: Pick<Incidente, 'geometria' | 'perimetro'>): readonly CandidataDespacho[] {
  const destino = ubicacionDeIncidente(incidente);
  const indicativos = indicativosDe(recursos);
  return recursos
    .filter((r) => r.estado_actual === 'DISPONIBLE')
    .map((recurso): CandidataDespacho => {
      const origen = posicionDe(recurso);
      return { recurso, indicativo: indicativos.get(recurso.id) ?? recurso.id, distanciaM: origen ? distanciaM(origen, destino) : null };
    })
    .sort((a, b) => {
      if (a.distanciaM === null || b.distanciaM === null) {
        if (a.distanciaM === b.distanciaM) return a.indicativo.localeCompare(b.indicativo, 'es', { numeric: true });
        return a.distanciaM === null ? 1 : -1;
      }
      return a.distanciaM - b.distanciaM || a.indicativo.localeCompare(b.indicativo, 'es', { numeric: true });
    });
}

/** "640 m" o "1,3 km" (con coma en español y punto en inglés); `—` si no se conoce la distancia. */
export function formatearDistancia(metros: number | null, idioma: 'es' | 'en'): string {
  if (metros === null) return '—';
  if (metros < 1000) return `${Math.round(metros)} m`;
  return `${(metros / 1000).toLocaleString(idioma, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} km`;
}
