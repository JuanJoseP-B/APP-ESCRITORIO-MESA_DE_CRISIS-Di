import type { GeoJsonGeometry, Incidente, NivelCriticidad } from '@argos/shared';

export interface FeatureIncidente {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: GeoJsonGeometry;
  readonly properties: {
    readonly id: string;
    readonly titulo: string;
    readonly nivel_criticidad: NivelCriticidad;
    readonly estado: Incidente['estado'];
    readonly color: string;
  };
}

export interface FeatureCollectionIncidentes {
  readonly type: 'FeatureCollection';
  readonly features: readonly FeatureIncidente[];
}

/** Colores de criticidad según la paleta ARGOS (SPEC §10). */
export const COLOR_CRITICIDAD: Record<NivelCriticidad, string> = {
  Crítico: '#E53935',
  Medio: '#FFB300',
  Bajo: '#43A047',
};

export function incidentesAFeatureCollection(
  incidentes: readonly Incidente[],
): FeatureCollectionIncidentes {
  return {
    type: 'FeatureCollection',
    features: incidentes.map((i) => ({
      type: 'Feature',
      id: i.id,
      geometry: i.geometria,
      properties: {
        id: i.id,
        titulo: i.titulo,
        nivel_criticidad: i.nivel_criticidad,
        estado: i.estado,
        color: COLOR_CRITICIDAD[i.nivel_criticidad],
      },
    })),
  };
}
