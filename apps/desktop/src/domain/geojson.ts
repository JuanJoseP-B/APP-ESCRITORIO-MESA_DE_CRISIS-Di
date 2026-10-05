import {
  etiquetaTipoEmergencia,
  puedeValidarReporte,
  type GeoJsonGeometry,
  type GeometriaZona,
  type Incidente,
  type NivelCriticidad,
  type Reporte,
  type ZonaPublica,
} from '@argos/shared';

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

/** Paleta ARGOS para las capas operativas que no dependen de la criticidad. */
export const COLOR_REFUGIO = '#43A047';
export const COLOR_BLOQUEO = '#FFB300';
export const COLOR_REPORTE = '#0F172A';

export interface FeatureOperativa {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: GeometriaZona;
  readonly properties: {
    readonly id: string;
    readonly nombre: string;
    readonly color: string;
    /** Solo reportes: resalta el elegido en la bandeja. */
    readonly seleccionado: boolean;
  };
}

export interface FeatureCollectionOperativa {
  readonly type: 'FeatureCollection';
  readonly features: readonly FeatureOperativa[];
}

/** Refugios y zonas trazadas (polígonos o líneas) de `zonas_publicas`. */
export function zonasAFeatureCollection(zonas: readonly ZonaPublica[]): FeatureCollectionOperativa {
  return {
    type: 'FeatureCollection',
    features: zonas.map((z) => ({
      type: 'Feature',
      id: z.id,
      geometry: z.geometria,
      properties: {
        id: z.id,
        nombre: z.nombre,
        color: z.tipo === 'Refugio' ? COLOR_REFUGIO : COLOR_BLOQUEO,
        seleccionado: false,
      },
    })),
  };
}

/** Reportes ciudadanos aún sin validar, como puntos [lng, lat]. */
export function reportesAFeatureCollection(
  reportes: readonly Reporte[],
  seleccionadoId: string | null,
): FeatureCollectionOperativa {
  return {
    type: 'FeatureCollection',
    features: reportes.filter(puedeValidarReporte).map((r) => ({
      type: 'Feature',
      id: r.id,
      geometry: { type: 'Point', coordinates: [r.lng, r.lat] },
      properties: {
        id: r.id,
        nombre: etiquetaTipoEmergencia(r.tipo),
        color: COLOR_REPORTE,
        seleccionado: r.id === seleccionadoId,
      },
    })),
  };
}
