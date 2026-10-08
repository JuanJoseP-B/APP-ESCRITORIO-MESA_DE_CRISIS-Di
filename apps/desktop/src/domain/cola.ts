import type { Incidente, NivelCriticidad, Recurso } from '@argos/shared';

// TODO(F2-01): migrar a Prioridad P1–P4 (hoy el orden usa `nivel_criticidad`: Crítico, Medio, Bajo).
const RANGO_CRITICIDAD: Readonly<Record<NivelCriticidad, number>> = { Crítico: 0, Medio: 1, Bajo: 2 };

const aMs = (valor: unknown): number | null => {
  if (typeof valor !== 'string') return null;
  const ms = Date.parse(valor);
  return Number.isNaN(ms) ? null : ms;
};

const marcasDeTiempo = (i: Pick<Incidente, 'timeline'>): number[] =>
  (Array.isArray(i.timeline) ? i.timeline : []).flatMap((e) => {
    const ms = aMs((e as { timestamp?: unknown } | null)?.timestamp);
    return ms === null ? [] : [ms];
  });

/**
 * Cuándo se abrió el incidente (ms epoch): su evento más antiguo. `incidentes` no tiene `creado_en`
 * (llega con la migración 0006), así que se deriva de la línea de tiempo; `null` si no hay fechas.
 */
export function aperturaDeIncidente(i: Pick<Incidente, 'timeline'>): number | null {
  const marcas = marcasDeTiempo(i);
  return marcas.length === 0 ? null : Math.min(...marcas);
}

/** Minutos enteros que lleva abierto; `null` si no se conoce la apertura. Nunca negativo. */
export function minutosAbierto(i: Pick<Incidente, 'timeline'>, ahoraMs: number): number | null {
  const apertura = aperturaDeIncidente(i);
  return apertura === null ? null : Math.max(0, Math.floor((ahoraMs - apertura) / 60_000));
}

export const estaCerrado = (i: Pick<Incidente, 'estado'>): boolean => i.estado === 'Resuelto';

/** Activos: todo lo que no está resuelto. */
export const incidentesActivos = (incidentes: readonly Incidente[]): readonly Incidente[] =>
  incidentes.filter((i) => !estaCerrado(i));

/** Más crítico primero; a igual criticidad, el más antiguo primero (sin fecha, al final); luego por id. */
export function ordenarCola(incidentes: readonly Incidente[]): readonly Incidente[] {
  const apertura = (i: Incidente) => aperturaDeIncidente(i) ?? Number.POSITIVE_INFINITY;
  return [...incidentes].sort((a, b) => {
    const criticidad = RANGO_CRITICIDAD[a.nivel_criticidad] - RANGO_CRITICIDAD[b.nivel_criticidad];
    if (criticidad !== 0) return criticidad;
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
