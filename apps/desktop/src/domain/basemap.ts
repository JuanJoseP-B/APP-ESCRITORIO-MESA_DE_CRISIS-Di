/** Propiedades de pintura de la capa raster del basemap (MapLibre `raster-*`). */
export interface PinturaBasemap {
  readonly 'raster-saturation': number;
  readonly 'raster-contrast': number;
  readonly 'raster-brightness-min': number;
  readonly 'raster-brightness-max': number;
}

/**
 * Basemap desaturado por turno: el color del mapa se reserva a la semántica (criticidad, refugios,
 * bloqueos), así que los tiles de OSM se llevan a grises. En Carbón además se oscurecen para no
 * deslumbrar y que las capas tácticas resalten.
 */
export function pinturaBasemap(tema: string | undefined): PinturaBasemap {
  return tema === 'carbon'
    ? {
        'raster-saturation': -1,
        'raster-contrast': -0.1,
        'raster-brightness-min': 0,
        'raster-brightness-max': 0.4,
      }
    : {
        'raster-saturation': -0.9,
        'raster-contrast': -0.1,
        'raster-brightness-min': 0.08,
        'raster-brightness-max': 1,
      };
}
