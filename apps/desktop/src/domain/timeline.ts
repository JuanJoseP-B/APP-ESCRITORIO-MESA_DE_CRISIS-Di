export interface EventoVisible {
  /** Hora "HH:mm" lista para mostrar; `--:--` si no se puede determinar. */
  readonly hora: string;
  /** Fecha ISO válida para `<time dateTime>`, o `null` si el evento no la trae. */
  readonly iso: string | null;
  readonly descripcion: string;
  /** Operador u origen que registró el evento; `null` en filas antiguas que no lo guardaron. */
  readonly autor: string | null;
}

/** Corte de día en la bitácora: aparece antes del primer evento de cada fecha. */
export interface SeparadorFecha {
  readonly tipo: 'fecha';
  /** Día en la zona mostrada, "YYYY-MM-DD" (válido para `<time dateTime>`). */
  readonly clave: string;
  /** Texto legible, p. ej. "07 oct 2026". */
  readonly etiqueta: string;
}

export type EntradaBitacora = ({ readonly tipo: 'evento' } & EventoVisible) | SeparadorFecha;

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

interface EventoOrdenable extends EventoVisible {
  /** Milisegundos epoch del `timestamp`; `null` si el evento no trae fecha válida. */
  readonly ms: number | null;
}

function adaptar(timeline: unknown, zona?: string): EventoOrdenable[] {
  if (!Array.isArray(timeline)) return [];
  return timeline.flatMap((crudo: unknown): EventoOrdenable[] => {
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
        autor: texto(e['autor']),
        ms: iso === null ? null : new Date(iso).getTime(),
      },
    ];
  });
}

/**
 * Orden estricto por `timestamp`. Los eventos sin fecha (filas antiguas `{hora, evento}`) no se pueden
 * situar en el calendario: van primero, ordenados por su hora, y los demás en orden cronológico.
 * Los empates conservan el orden original.
 */
function ordenar(eventos: EventoOrdenable[]): EventoOrdenable[] {
  return eventos
    .map((evento, posicion) => ({ evento, posicion }))
    .sort((a, b) => {
      const [x, y] = [a.evento, b.evento];
      if (x.ms === null && y.ms === null) return x.hora.localeCompare(y.hora) || a.posicion - b.posicion;
      if (x.ms === null) return -1;
      if (y.ms === null) return 1;
      return x.ms - y.ms || a.posicion - b.posicion;
    })
    .map(({ evento }) => evento);
}

const sinMs = (e: EventoOrdenable): EventoVisible => ({
  hora: e.hora,
  iso: e.iso,
  descripcion: e.descripcion,
  autor: e.autor,
});

/**
 * Adapta el `timeline` (JSONB sin esquema) a lo que pinta la UI, en orden cronológico. Además de
 * `{timestamp, descripcion, autor?}` tolera las filas cargadas a mano con `{hora: "14:02", evento}`.
 */
export function eventosVisibles(timeline: unknown, zona?: string): readonly EventoVisible[] {
  return ordenar(adaptar(timeline, zona)).map(sinMs);
}

const claveDia = (ms: number, zona?: string): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: zona, year: 'numeric', month: '2-digit', day: '2-digit' }).format(ms);

const etiquetaDia = (ms: number, zona?: string): string =>
  new Intl.DateTimeFormat('es', { timeZone: zona, day: '2-digit', month: 'short', year: 'numeric' })
    .format(ms)
    .replace(/\./g, '');

/**
 * Bitácora de un incidente: eventos en orden cronológico con un separador de fecha antes del primer
 * evento de cada día. Los eventos sin fecha no llevan separador.
 */
export function bitacora(timeline: unknown, zona?: string): readonly EntradaBitacora[] {
  const entradas: EntradaBitacora[] = [];
  let diaActual: string | null = null;
  for (const evento of ordenar(adaptar(timeline, zona))) {
    if (evento.ms !== null) {
      const dia = claveDia(evento.ms, zona);
      if (dia !== diaActual) {
        diaActual = dia;
        entradas.push({ tipo: 'fecha', clave: dia, etiqueta: etiquetaDia(evento.ms, zona) });
      }
    }
    entradas.push({ tipo: 'evento', ...sinMs(evento) });
  }
  return entradas;
}
