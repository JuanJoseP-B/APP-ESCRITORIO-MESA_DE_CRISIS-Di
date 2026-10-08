/**
 * Desfase (ms) entre el reloj del servidor y el local: positivo si el servidor va adelantado.
 * Se asume que la respuesta se generó a mitad del viaje, así que el reloj local se compara con el
 * punto medio entre el envío y la recepción de la petición.
 */
export function calcularDesfaseMs(horaServidorMs: number, envioMs: number, recepcionMs: number): number {
  return Math.round(horaServidorMs - (envioMs + recepcionMs) / 2);
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

/** Desfase de la zona respecto a UTC, p. ej. "UTC-5"; sin `zona` usa la del sistema. */
export function etiquetaZonaHoraria(ms: number, zona?: string): string {
  const partes = new Intl.DateTimeFormat('en', { timeZone: zona, timeZoneName: 'shortOffset' }).formatToParts(ms);
  const nombre = partes.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT';
  const etiqueta = nombre.replace('GMT', 'UTC');
  return etiqueta === 'UTC+0' ? 'UTC' : etiqueta;
}

/** "mm:ss" para una duración en segundos (se trunca; lo negativo cuenta como 0). */
export function formatearMinSeg(segundos: number): string {
  const total = Math.max(0, Math.floor(segundos));
  const dos = (n: number): string => String(n).padStart(2, '0');
  return `${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
}
