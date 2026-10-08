import { rangoPrioridad, type Llamada, type Reporte } from '@argos/shared';

/** Cuánto tiempo (según el reloj de la consola) una llamada recién llegada se muestra resaltada. */
export const VENTANA_NUEVA_MS = 12_000;

const aMs = (iso: string): number => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Llamadas sin vincular ni descartar: P1 primero y, a igual prioridad, la más reciente arriba para que
 * la que acaba de entrar quede a la vista.
 */
export function entrantes(llamadas: readonly Llamada[]): readonly Llamada[] {
  return llamadas
    .filter((l) => l.incidenteId === null && l.estadoValidacion === 'No confirmado')
    .sort(
      (a, b) =>
        rangoPrioridad(a.prioridad) - rangoPrioridad(b.prioridad) ||
        aMs(b.creadoEn) - aMs(a.creadoEn) ||
        a.id.localeCompare(b.id),
    );
}

/** Segundos desde que entró la llamada; nunca negativo. */
export const segundosDesde = (llamada: Pick<Llamada, 'creadoEn'>, ahoraMs: number): number =>
  Math.max(0, Math.floor((ahoraMs - aMs(llamada.creadoEn)) / 1000));

/** `true` mientras la llamada lleva menos de `ventanaMs` en la bandeja. */
export const esLlamadaNueva = (llamada: Pick<Llamada, 'creadoEn'>, ahoraMs: number, ventanaMs = VENTANA_NUEVA_MS): boolean =>
  ahoraMs - aMs(llamada.creadoEn) < ventanaMs;

/** Vista de una llamada con la forma de `Reporte`, que el mapa aún usa para pintar las pendientes. */
export const reporteDeLlamada = (l: Llamada): Reporte => ({
  id: l.id,
  tipo: l.tipo,
  lat: l.ubicacion.lat,
  lng: l.ubicacion.lng,
  imagen_url: null,
  estado_validacion: l.estadoValidacion,
  creado_en: l.creadoEn,
});
