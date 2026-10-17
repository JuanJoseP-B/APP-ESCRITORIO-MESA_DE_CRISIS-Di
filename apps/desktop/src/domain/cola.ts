import { rangoPrioridad, type Incidente, type Recurso } from '@argos/shared';

const aMs = (valor: unknown): number | null => {
  if (typeof valor !== 'string') return null;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? null : ms;
};

/** Instante de cada evento: `creado_en` (hora del servidor) y, si falta, `timestamp` (filas antiguas). */
const marcasDeTiempo = (i: Pick<Incidente, 'timeline'>): number[] =>
  (Array.isArray(i.timeline) ? i.timeline : []).flatMap((e) => {
    const evento = e as { creado_en?: unknown; timestamp?: unknown } | null;
    const ms = aMs(evento?.creado_en) ?? aMs(evento?.timestamp);
    return ms === null ? [] : [ms];
  });

/**
 * Cuándo se abrió el incidente (ms epoch): su `creado_en` (hora del servidor, migración 0006) y, si falta,
 * el evento más antiguo de la línea de tiempo; `null` si no hay fechas.
 */
export function aperturaDeIncidente(i: Pick<Incidente, 'timeline' | 'creado_en'>): number | null {
  const creado = aMs(i.creado_en);
  if (creado !== null) return creado;
  const marcas = marcasDeTiempo(i);
  return marcas.length === 0 ? null : Math.min(...marcas);
}

/** Minutos enteros que lleva abierto; `null` si no se conoce la apertura. Nunca negativo. */
export function minutosAbierto(i: Pick<Incidente, 'timeline' | 'creado_en'>, ahoraMs: number): number | null {
  const apertura = aperturaDeIncidente(i);
  return apertura === null ? null : Math.max(0, Math.floor((ahoraMs - apertura) / 60_000));
}

export const estaCerrado = (i: Pick<Incidente, 'estado'>): boolean => i.estado === 'Resuelto';

/** Activos: todo lo que no está resuelto. */
export const incidentesActivos = (incidentes: readonly Incidente[]): readonly Incidente[] =>
  incidentes.filter((i) => !estaCerrado(i));

/** P1 primero; a igual prioridad, el más antiguo primero (sin fecha, al final); luego por id. */
export function ordenarCola(incidentes: readonly Incidente[]): readonly Incidente[] {
  const apertura = (i: Incidente) => aperturaDeIncidente(i) ?? Number.POSITIVE_INFINITY;
  return [...incidentes].sort((a, b) => {
    const prioridad = rangoPrioridad(a.prioridad) - rangoPrioridad(b.prioridad);
    if (prioridad !== 0) return prioridad;
    const antiguedad = apertura(a) - apertura(b);
    if (antiguedad !== 0 && !Number.isNaN(antiguedad)) return antiguedad;
    return a.id.localeCompare(b.id);
  });
}

/** Cerrados: el más recientemente actualizado primero. */
export function ordenarCerrados(incidentes: readonly Incidente[]): readonly Incidente[] {
  const ultimo = (i: Incidente) => Math.max(Number.NEGATIVE_INFINITY, ...marcasDeTiempo(i));
  return [...incidentes].sort((a, b) => {
    const d = ultimo(b) - ultimo(a);
    return d !== 0 && !Number.isNaN(d) ? d : a.id.localeCompare(b.id);
  });
}

export interface ColaDividida {
  readonly activos: readonly Incidente[];
  readonly cerrados: readonly Incidente[];
}

/** Separa la cola operativa de la pestaña "Cerrados". */
export function dividirCola(incidentes: readonly Incidente[]): ColaDividida {
  return {
    activos: ordenarCola(incidentesActivos(incidentes)),
    cerrados: ordenarCerrados(incidentes.filter(estaCerrado)),
  };
}

/** Unidades asignadas por incidente (solo recursos con incidente). */
export function unidadesPorIncidente(recursos: readonly Recurso[]): ReadonlyMap<string, number> {
  const cuenta = new Map<string, number>();
  for (const r of recursos) {
    if (r.incidente_asignado_id) cuenta.set(r.incidente_asignado_id, (cuenta.get(r.incidente_asignado_id) ?? 0) + 1);
  }
  return cuenta;
}

/** Código corto y dictable del incidente: las 3 últimas letras o dígitos de su id, en mayúsculas. */
export const codigoIncidente = (id: string): string => id.replace(/[^a-z0-9]/gi, '').slice(-3).toUpperCase();

/**
 * Id que queda tras mover la selección `delta` posiciones en `orden` (J/K); no da la vuelta. Sin
 * selección (o con una que ya no está en la lista) arranca en el primero o el último según el sentido.
 */
export function moverSeleccion(orden: readonly string[], actualId: string | null, delta: 1 | -1): string | null {
  if (orden.length === 0) return null;
  const actual = actualId === null ? -1 : orden.indexOf(actualId);
  if (actual === -1) return orden[delta === 1 ? 0 : orden.length - 1] ?? null;
  return orden[Math.min(orden.length - 1, Math.max(0, actual + delta))] ?? null;
}

/** Deja solo los elementos cuyo id está en `ids`; con `ids` en `null` no filtra. */
export function filtrarPorIds<T extends { readonly id: string }>(items: readonly T[], ids: ReadonlySet<string> | null): readonly T[] {
  return ids === null ? items : items.filter((i) => ids.has(i.id));
}
