import { TIPOS_RECURSO, type Recurso, type TipoRecurso } from '@argos/shared';

/** Inicial del indicativo cuando la unidad no trae `etiqueta` (p. ej. "B-01" para Bomberos). */
const INICIAL_TIPO: Readonly<Record<TipoRecurso, string>> = { Bomberos: 'B', Ambulancia: 'M', Policía: 'P' };

const NN = (n: number): string => String(n).padStart(2, '0');

/**
 * Indicativo completo de cada unidad (nunca truncado). Usa la `etiqueta` guardada ("U01", "M11"); si
 * falta, genera "<inicial>-<NN>" según su posición entre las unidades del mismo tipo (orden por id).
 */
export function indicativosDe(recursos: readonly Recurso[]): ReadonlyMap<string, string> {
  const mapa = new Map<string, string>();
  for (const tipo of TIPOS_RECURSO) {
    recursos
      .filter((r) => r.tipo === tipo)
      .sort((a, b) => a.id.localeCompare(b.id))
      .forEach((r, n) => mapa.set(r.id, r.etiqueta?.trim() || `${INICIAL_TIPO[tipo]}-${NN(n + 1)}`));
  }
  return mapa;
}

/** Orden del tablero: por tipo (Bomberos, Ambulancia, Policía) y luego por indicativo. */
export function ordenarUnidades(recursos: readonly Recurso[]): readonly Recurso[] {
  const indicativos = indicativosDe(recursos);
  const rango = (r: Recurso) => TIPOS_RECURSO.indexOf(r.tipo);
  return [...recursos].sort(
    (a, b) =>
      rango(a) - rango(b) ||
      (indicativos.get(a.id) ?? '').localeCompare(indicativos.get(b.id) ?? '', 'es', { numeric: true }),
  );
}

export interface ResumenUnidades {
  readonly total: number;
  readonly disponibles: number;
}

export function resumirUnidades(recursos: readonly Recurso[]): ResumenUnidades {
  return { total: recursos.length, disponibles: recursos.filter((r) => r.estado_actual === 'DISPONIBLE').length };
}
