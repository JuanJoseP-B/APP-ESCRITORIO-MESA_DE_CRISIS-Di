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
import { aPosicion } from './geo';
import type { MovimientoUnidad } from './movimiento';

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

/**
 * Los colores del mapa se expresan como nombre de token de @argos/ui (sin `--`); MapView los
 * resuelve al valor del turno activo (crema/carbón) antes de pintar.
 */
export type TokenColor = string;

/** Criticidad → token de estado (rojo solo para riesgo vital). */
export const COLOR_CRITICIDAD: Record<NivelCriticidad, TokenColor> = {
  Crítico: 'status-critical',
  Medio: 'status-warning',
  Bajo: 'status-success',
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

/** Tokens para las capas operativas que no dependen de la criticidad. */
export const COLOR_REFUGIO: TokenColor = 'status-success';
export const COLOR_BLOQUEO: TokenColor = 'status-warning';
export const COLOR_REPORTE: TokenColor = 'border-strong';

/** Sustituye el token de `properties.color` por su valor en el tema activo. */
export function colorearFeatures<T extends { readonly features: readonly { readonly properties: { readonly color: string } }[] }>(
  coleccion: T,
  resolver: (token: TokenColor) => string,
): T {
  return {
    ...coleccion,
    features: coleccion.features.map((f) => ({ ...f, properties: { ...f.properties, color: resolver(f.properties.color) } })),
  };
}

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

/** Tramo que le falta recorrer a cada unidad en ruta, de su posici�n actual al incidente. */
export const COLOR_RUTA: TokenColor = 'status-warning';

export interface FeatureRuta {
  readonly type: 'Feature';
  readonly id: string;
  readonly geometry: { readonly type: 'LineString'; readonly coordinates: readonly [readonly [number, number], readonly [number, number]] };
  readonly properties: { readonly id: string; readonly color: string };
}

export interface FeatureCollectionRutas {
  readonly type: 'FeatureCollection';
  readonly features: readonly FeatureRuta[];
}

export function rutasAFeatureCollection(movimientos: readonly MovimientoUnidad[]): FeatureCollectionRutas {
  return {
    type: 'FeatureCollection',
    features: movimientos
      .filter((m) => !m.llego)
      .map((m) => ({
        type: 'Feature',
        id: m.recursoId,
        geometry: { type: 'LineString', coordinates: [aPosicion(m.posicion), aPosicion(m.destino)] },
        properties: { id: m.recursoId, color: COLOR_RUTA },
      })),
  };
}
