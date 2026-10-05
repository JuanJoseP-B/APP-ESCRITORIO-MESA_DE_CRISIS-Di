import type { StyleSpecification } from 'maplibre-gl';

export const CENTRO_INICIAL: [number, number] = [-70.65, -33.45];

/** Estilo base raster; sustituible con VITE_MAP_STYLE_URL (estilo propio MapLibre/Mapbox). */
const ESTILO_POR_DEFECTO: StyleSpecification = {
  version: 8,
  sources: {
    base: {
      type: 'raster',
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      tileSize: 256,
      attribution: '© OpenStreetMap',
    },
  },
  layers: [{ id: 'base', type: 'raster', source: 'base' }],
};

export function estiloMapa(): string | StyleSpecification {
  return (import.meta.env['VITE_MAP_STYLE_URL'] as string | undefined) || ESTILO_POR_DEFECTO;
}
