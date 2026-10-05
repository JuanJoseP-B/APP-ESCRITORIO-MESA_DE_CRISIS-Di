/** Posición GeoJSON: [longitud, latitud]. */
export type Posicion = readonly [lng: number, lat: number];

export interface GeoJsonPoint {
  readonly type: 'Point';
  readonly coordinates: Posicion;
}

export interface GeoJsonPolygon {
  readonly type: 'Polygon';
  /** Anillos lineales; el primero es el exterior. */
  readonly coordinates: readonly (readonly Posicion[])[];
}

export interface GeoJsonLineString {
  readonly type: 'LineString';
  readonly coordinates: readonly Posicion[];
}

export type GeoJsonGeometry = GeoJsonPoint | GeoJsonPolygon;

/** Geometría de una zona pública: además admite líneas (p. ej. un tramo de vía bloqueado). */
export type GeometriaZona = GeoJsonGeometry | GeoJsonLineString;

export interface Coordenadas {
  readonly lat: number;
  readonly lng: number;
}
