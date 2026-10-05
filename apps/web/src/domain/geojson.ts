import type { GeometriaZona, NivelCriticidad, ZonaPublica, ZonaRiesgo } from '@argos/shared';

/** Colores de la paleta ARGOS (SPEC §10). */
export const COLOR_CRITICIDAD: Record<NivelCriticidad, string> = {
  Crítico: '#E53935',
  Medio: '#FFB300',
  Bajo: '#43A047',
};
export const COLOR_REFUGIO = '#43A047';
export const COLOR_BLOQUEO = '#FFB300';

export type CategoriaCapa = 'riesgo' | 'refugio' | 'bloqueo';

export interface FeaturePublica {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: GeometriaZona;
  readonly properties: {
    readonly id: string;
    readonly categoria: CategoriaCapa;
    readonly nombre: string;
    readonly color: string;
    /** Solo refugios: "actual/máxima". */
    readonly ocupacion: string;
  };
}

export interface FeatureCollectionPublica {
  readonly type: 'FeatureCollection';
  readonly features: readonly FeaturePublica[];
}

export function ocupacionRefugio(zona: Pick<ZonaPublica, 'capacidad_actual' | 'capacidad_maxima'>): string {
  return `${zona.capacidad_actual}/${zona.capacidad_maxima}`;
}

/** Combina zonas de riesgo y zonas públicas en una sola colección; excluye incidentes resueltos. */
export function zonasAFeatureCollection(
  riesgo: readonly ZonaRiesgo[],
  publicas: readonly ZonaPublica[],
): FeatureCollectionPublica {
  const deRiesgo: FeaturePublica[] = riesgo
    .filter((z) => z.estado !== 'Resuelto')
    .map((z) => ({
      type: 'Feature',
      id: z.id,
      geometry: z.geometria,
      properties: {
        id: z.id,
        categoria: 'riesgo',
        nombre: z.titulo,
        color: COLOR_CRITICIDAD[z.nivel_criticidad],
        ocupacion: '',
      },
    }));
  const dePublicas: FeaturePublica[] = publicas.map((z) => {
    const refugio = z.tipo === 'Refugio';
    return {
      type: 'Feature',
      id: z.id,
      geometry: z.geometria,
      properties: {
        id: z.id,
        categoria: refugio ? 'refugio' : 'bloqueo',
        nombre: z.nombre,
        color: refugio ? COLOR_REFUGIO : COLOR_BLOQUEO,
        ocupacion: refugio ? ocupacionRefugio(z) : '',
      },
    };
  });
  return { type: 'FeatureCollection', features: [...deRiesgo, ...dePublicas] };
}
