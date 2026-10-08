import type { ZonaPublica } from '@argos/shared';

/** Capas del mapa que el operador puede encender o apagar desde la leyenda. */
export const CAPAS_MAPA = ['unidades', 'perimetros', 'refugios', 'bloqueos'] as const;
export type CapaMapa = (typeof CAPAS_MAPA)[number];
export type CapasMapa = Readonly<Record<CapaMapa, boolean>>;

/** Todas visibles: el mapa arranca contando la crisis completa. */
export const CAPAS_POR_DEFECTO: CapasMapa = { unidades: true, perimetros: true, refugios: true, bloqueos: true };

export const alternarCapa = (capas: CapasMapa, capa: CapaMapa): CapasMapa => ({ ...capas, [capa]: !capas[capa] });

/** Zonas públicas que se pintan: los refugios y los bloqueos (puntos, líneas y áreas trazadas) se apagan por separado. */
export function zonasVisibles(zonas: readonly ZonaPublica[], capas: CapasMapa): readonly ZonaPublica[] {
  if (capas.refugios && capas.bloqueos) return zonas;
  return zonas.filter((z) => (z.tipo === 'Refugio' ? capas.refugios : capas.bloqueos));
}
