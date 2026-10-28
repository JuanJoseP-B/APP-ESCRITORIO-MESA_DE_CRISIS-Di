import type { EventoRecurso, Incidente, Llamada } from '@argos/shared';
import { aperturaDeIncidente } from './cola';

/** Hitos de la vida de un incidente, en el orden en que suelen ocurrir. */
export const HITOS = ['LLAMADA', 'CREADO', 'DESPACHADA', 'EN_RUTA', 'EN_ESCENA', 'CONTENIDO', 'RESUELTO'] as const;
export type Hito = (typeof HITOS)[number];

/**
 * - `hecho`: ya ocurrió.
 * - `actual`: el último que ocurrió mientras el incidente sigue abierto («AHORA»).
 * - `omitido`: no consta, pero ya ocurrió uno posterior (p. ej. se contuvo sin despachar).
 * - `pendiente`: aún no ha llegado.
 */
export type EstadoHito = 'hecho' | 'actual' | 'omitido' | 'pendiente';

export interface HitoIncidente {
  readonly hito: Hito;
  readonly estado: EstadoHito;
  /** Cuándo ocurrió (ms epoch); `null` si no ocurrió o los datos no traen la hora. */
  readonly ms: number | null;
  /** Unidad del primer evento (despacho, en ruta, en escena). */
  readonly recursoId: string | null;
  /** Canal de la primera llamada vinculada. */
  readonly canal: string | null;
}

interface Marca {
  readonly ms: number | null;
  readonly recursoId?: string | null;
  readonly canal?: string | null;
}

const aMs = (iso: unknown): number | null => {
  if (typeof iso !== 'string') return null;
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? null : ms;
};

/** Primer evento del incidente que lleva una unidad al estado `hacia`. */
function primerEvento(eventos: readonly EventoRecurso[], incidenteId: string, hacia: EventoRecurso['hacia']): Marca | null {
  let mejor: EventoRecurso | null = null;
  for (const e of eventos) {
    if (e.incidenteId !== incidenteId || e.hacia !== hacia) continue;
    if (!mejor || (aMs(e.creadoEn) ?? Infinity) < (aMs(mejor.creadoEn) ?? Infinity)) mejor = e;
  }
  return mejor ? { ms: aMs(mejor.creadoEn), recursoId: mejor.recursoId } : null;
}

/** Hora del último «Estado cambiado a {estado}» de la bitácora del incidente. */
function cambioDeEstado(incidente: Pick<Incidente, 'timeline'>, estado: string): number | null {
  if (!Array.isArray(incidente.timeline)) return null;
  let ms: number | null = null;
  for (const crudo of incidente.timeline as readonly unknown[]) {
    if (typeof crudo !== 'object' || crudo === null) continue;
    const e = crudo as Record<string, unknown>;
    if (e['descripcion'] !== `Estado cambiado a ${estado}`) continue;
    ms = aMs(e['creado_en']) ?? aMs(e['timestamp']) ?? ms;
  }
  return ms;
}

/**
 * Hitos del incidente derivados de lo que ya existe: llamadas vinculadas, eventos de las unidades y su estado.
 * No inventa nada: un hito sin dato no ocurrió (o se marca omitido si ya pasó uno posterior). Sin llamadas
 * vinculadas (incidente abierto a mano) el hito «Llamada recibida» no aparece.
 */
export function hitosDeIncidente(
  incidente: Pick<Incidente, 'id' | 'estado' | 'timeline' | 'creado_en'>,
  llamadas: readonly Llamada[],
  eventos: readonly EventoRecurso[],
): readonly HitoIncidente[] {
  const vinculadas = llamadas
    .filter((l) => l.incidenteId === incidente.id)
    .sort((a, b) => (aMs(a.creadoEn) ?? Infinity) - (aMs(b.creadoEn) ?? Infinity));
  const primera = vinculadas[0];
  const contenido = incidente.estado === 'Contenido' || incidente.estado === 'Resuelto';
  const marcas: Readonly<Record<Hito, Marca | null>> = {
    LLAMADA: primera ? { ms: aMs(primera.creadoEn), canal: primera.canal } : null,
    CREADO: { ms: aperturaDeIncidente(incidente) },
    DESPACHADA: primerEvento(eventos, incidente.id, 'ASIGNADO'),
    EN_RUTA: primerEvento(eventos, incidente.id, 'EN_RUTA'),
    EN_ESCENA: primerEvento(eventos, incidente.id, 'EN_ESCENA'),
    CONTENIDO: contenido ? { ms: cambioDeEstado(incidente, 'Contenido') } : null,
    RESUELTO: incidente.estado === 'Resuelto' ? { ms: cambioDeEstado(incidente, 'Resuelto') } : null,
  };
  const visibles = HITOS.filter((h) => h !== 'LLAMADA' || marcas.LLAMADA !== null);
  const ultimo = visibles.reduce((n, h, i) => (marcas[h] ? i : n), -1);
  const resuelto = incidente.estado === 'Resuelto';
  return visibles.map((hito, i): HitoIncidente => {
    const marca = marcas[hito];
    const estado: EstadoHito = marca
      ? i === ultimo && !resuelto
        ? 'actual'
        : 'hecho'
      : i < ultimo
        ? 'omitido'
        : 'pendiente';
    return { hito, estado, ms: marca?.ms ?? null, recursoId: marca?.recursoId ?? null, canal: marca?.canal ?? null };
  });
}
