import type { Coordenadas, EventoRecurso, Incidente, Recurso, TipoRecurso } from '@argos/shared';
import { distanciaM, ubicacionDeIncidente } from './geo';

/**
 * Velocidad media en ruta (m/s) por tipo de unidad. Valores fijos y orientativos para el demo: a esa marcha las
 * unidades de las bases de Pasto tardan entre 20 y 60 s en llegar a un incidente del centro.
 */
export const VELOCIDAD_MS: Readonly<Record<TipoRecurso, number>> = {
  Ambulancia: 14,
  Policía: 16,
  Bomberos: 11,
};

/** Cuántos saltos hace el recorrido cuando se reduce el movimiento (en vez de deslizarse). */
export const PASOS_SIN_ANIMACION = 4;

/** Trayecto recto de una unidad desde su base hasta el incidente. */
export interface Trayecto {
  readonly origen: Coordenadas;
  readonly destino: Coordenadas;
  /** Hora simulada (ms epoch) en que salió, la del evento EN_RUTA. */
  readonly salidaMs: number;
}

export interface EstadoTrayecto {
  /** 0 = en la base, 1 = en el incidente. */
  readonly progreso: number;
  readonly posicion: Coordenadas;
  /** Metros que faltan hasta el incidente, medidos desde la posición mostrada. */
  readonly restanteM: number;
  readonly llego: boolean;
}

const interpolar = (a: Coordenadas, b: Coordenadas, p: number): Coordenadas => ({
  lat: a.lat + (b.lat - a.lat) * p,
  lng: a.lng + (b.lng - a.lng) * p,
});

/** Segundos que tarda una unidad de ese tipo en cubrir el trayecto. */
export function duracionTrayectoSeg(tipo: TipoRecurso, trayecto: Pick<Trayecto, 'origen' | 'destino'>): number {
  return distanciaM(trayecto.origen, trayecto.destino) / VELOCIDAD_MS[tipo];
}

/**
 * Dónde está la unidad en `ahoraMs`: interpolación lineal entre origen y destino a la velocidad de su tipo.
 * Con `pasos` el progreso se discretiza (la unidad salta de posición en vez de deslizarse); llegar siempre vale 1.
 */
export function estadoTrayecto(tipo: TipoRecurso, trayecto: Trayecto, ahoraMs: number, pasos?: number): EstadoTrayecto {
  const duracionMs = duracionTrayectoSeg(tipo, trayecto) * 1000;
  const bruto = duracionMs <= 0 ? 1 : (ahoraMs - trayecto.salidaMs) / duracionMs;
  const real = Math.min(1, Math.max(0, bruto));
  const progreso = pasos && pasos > 0 && real < 1 ? Math.floor(real * pasos) / pasos : real;
  const posicion = progreso >= 1 ? trayecto.destino : interpolar(trayecto.origen, trayecto.destino, progreso);
  return { progreso, posicion, restanteM: distanciaM(posicion, trayecto.destino), llego: real >= 1 };
}

/** Unidad en ruta con su avance, listo para pintar la posición y la línea del recorrido restante. */
export interface MovimientoUnidad extends EstadoTrayecto {
  readonly recursoId: string;
  readonly incidenteId: string;
  readonly destino: Coordenadas;
}

/** Hora (ms epoch) del último paso a EN_RUTA de cada recurso. */
function salidas(eventos: readonly EventoRecurso[]): ReadonlyMap<string, number> {
  const mapa = new Map<string, number>();
  for (const e of eventos) {
    if (e.hacia !== 'EN_RUTA') continue;
    const ms = Date.parse(e.creadoEn);
    if (Number.isFinite(ms) && ms >= (mapa.get(e.recursoId) ?? -Infinity)) mapa.set(e.recursoId, ms);
  }
  return mapa;
}

/**
 * Avance de cada unidad EN_RUTA con incidente asignado, base conocida y salida registrada. Las que les falte
 * alguno de esos datos no se mueven: se quedan en su `ubicacion`.
 */
export function movimientosEnRuta(
  recursos: readonly Recurso[],
  eventos: readonly EventoRecurso[],
  incidentes: readonly Incidente[],
  ahoraMs: number,
  pasos?: number,
): readonly MovimientoUnidad[] {
  const salida = salidas(eventos);
  const movimientos: MovimientoUnidad[] = [];
  for (const r of recursos) {
    if (r.estado_actual !== 'EN_RUTA' || !r.incidente_asignado_id) continue;
    const incidente = incidentes.find((i) => i.id === r.incidente_asignado_id);
    const salidaMs = salida.get(r.id);
    const origen = r.base ?? r.ubicacion ?? null;
    if (!incidente || salidaMs === undefined || !origen) continue;
    const destino = ubicacionDeIncidente(incidente);
    movimientos.push({
      recursoId: r.id,
      incidenteId: incidente.id,
      destino,
      ...estadoTrayecto(r.tipo, { origen, destino, salidaMs }, ahoraMs, pasos),
    });
  }
  return movimientos;
}

/** Posición mostrada de cada unidad en movimiento, por id de recurso. */
export const posicionesDe = (movimientos: readonly MovimientoUnidad[]): ReadonlyMap<string, Coordenadas> =>
  new Map(movimientos.map((m) => [m.recursoId, m.posicion]));
