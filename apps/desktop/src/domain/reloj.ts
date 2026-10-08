/**
 * Desfase (ms) entre el reloj del servidor y el local: positivo si el servidor va adelantado.
 * Se asume que la respuesta se generó a mitad del viaje, así que el reloj local se compara con el
 * punto medio entre el envío y la recepción de la petición.
 */
export function calcularDesfaseMs(horaServidorMs: number, envioMs: number, recepcionMs: number): number {
  return Math.round(horaServidorMs - (envioMs + recepcionMs) / 2);
}

/** Milisegundos epoch de una cabecera HTTP `Date`; `null` si falta o no es una fecha válida. */
export function leerCabeceraDate(valor: string | null | undefined): number | null {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? null : ms;
}

/** "HH:mm:ss" en 24 h; `zona` es un identificador IANA (por defecto, la del sistema). */
export function formatearHoraConSegundos(ms: number, zona?: string): string {
  return new Intl.DateTimeFormat('es', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: zona,
  }).format(ms);
}
