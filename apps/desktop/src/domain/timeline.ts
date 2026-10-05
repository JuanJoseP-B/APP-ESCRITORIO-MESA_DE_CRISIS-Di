export interface EventoVisible {
  /** Hora "HH:mm" lista para mostrar; `--:--` si no se puede determinar. */
  readonly hora: string;
  /** Fecha ISO válida para `<time dateTime>`, o `null` si el evento no la trae. */
  readonly iso: string | null;
  readonly descripcion: string;
}

const SIN_HORA = '--:--';
const HORA_SUELTA = /^([01]?\d|2[0-3]):[0-5]\d$/;

const formato = (zona?: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('es', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: zona });

/** Hora local "HH:mm" de una fecha ISO; nunca devuelve "Invalid Date". */
export function formatearHora(valor: unknown, zona?: string): string {
  if (typeof valor !== 'string' || valor.trim() === '') return SIN_HORA;
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? SIN_HORA : formato(zona).format(fecha);
}

const texto = (valor: unknown): string | null => (typeof valor === 'string' && valor.trim() !== '' ? valor : null);

/**
 * Adapta el `timeline` (JSONB sin esquema) a lo que pinta la UI. Además de `{timestamp, descripcion}`
 * tolera las filas cargadas a mano con `{hora: "14:02", evento}`.
 */
export function eventosVisibles(timeline: unknown, zona?: string): readonly EventoVisible[] {
  if (!Array.isArray(timeline)) return [];
  return timeline.flatMap((crudo: unknown): EventoVisible[] => {
    if (typeof crudo !== 'object' || crudo === null) return [];
    const e = crudo as Record<string, unknown>;
    const hora = formatearHora(e['timestamp'], zona);
    const iso = hora === SIN_HORA ? null : (e['timestamp'] as string);
    const horaSuelta = texto(e['hora']);
    return [
      {
        hora: iso === null && horaSuelta && HORA_SUELTA.test(horaSuelta) ? horaSuelta.padStart(5, '0') : hora,
        iso,
        descripcion: texto(e['descripcion']) ?? texto(e['evento']) ?? 'Evento sin descripción',
      },
    ];
  });
}
