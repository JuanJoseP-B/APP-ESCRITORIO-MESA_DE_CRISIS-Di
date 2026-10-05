import { useEffect, useRef, useState } from 'react';
import {
  Map as MapLibreMap,
  NavigationControl,
  Popup,
  type GeoJSONSource,
  type StyleSpecification,
} from 'maplibre-gl';
import type { Coordenadas } from '@argos/shared';
import type { FeatureCollectionPublica } from '../domain/geojson';

const FUENTE = 'zonas';
const FUENTE_UBICACION = 'ubicacion';
const CENTRO_INICIAL: [number, number] = [-70.65, -33.45];
const CAPAS_INTERACTIVAS = ['zonas-relleno', 'zonas-puntos'];

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

const VACIO: FeatureCollectionPublica = { type: 'FeatureCollection', features: [] };

interface Props {
  readonly zonas: FeatureCollectionPublica;
  /** Ubicación del ciudadano; si cambia, el mapa se centra en ella. */
  readonly ubicacion: Coordenadas | null;
}

/** Mapa de solo lectura: sin edición ni dibujo. */
export function MapaPublico({ zonas, ubicacion }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapLibreMap | null>(null);
  const [listo, setListo] = useState(false);

  useEffect(() => {
    if (!contenedor.current) return;
    const estilo = (import.meta.env['VITE_MAP_STYLE_URL'] as string | undefined) || ESTILO_POR_DEFECTO;
    const m = new MapLibreMap({
      container: contenedor.current,
      style: estilo,
      center: CENTRO_INICIAL,
      zoom: 11,
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    m.on('load', () => {
      m.addSource(FUENTE, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'zonas-relleno',
        type: 'fill',
        source: FUENTE,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.28 },
      });
      m.addLayer({
        id: 'zonas-borde',
        type: 'line',
        source: FUENTE,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
      });
      // Tramos de vía bloqueados trazados por el operador como línea.
      m.addLayer({
        id: 'zonas-tramos',
        type: 'line',
        source: FUENTE,
        filter: ['==', '$type', 'LineString'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 4 },
      });
      m.addLayer({
        id: 'zonas-puntos',
        type: 'circle',
        source: FUENTE,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-radius': 9,
          'circle-color': ['get', 'color'],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      m.addSource(FUENTE_UBICACION, {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      m.addLayer({
        id: 'ubicacion-punto',
        type: 'circle',
        source: FUENTE_UBICACION,
        paint: {
          'circle-radius': 7,
          'circle-color': '#0f172a',
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 3,
        },
      });
      setListo(true);
    });

    m.on('click', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: CAPAS_INTERACTIVAS })[0];
      if (!f) return;
      const nombre = String(f.properties['nombre'] ?? '');
      const ocupacion = String(f.properties['ocupacion'] ?? '');
      const caja = document.createElement('div');
      caja.style.fontFamily = 'Space Grotesk, sans-serif';
      const titulo = document.createElement('strong');
      titulo.textContent = nombre;
      caja.append(titulo);
      if (ocupacion) {
        const detalle = document.createElement('div');
        detalle.style.fontFamily = 'JetBrains Mono, monospace';
        detalle.style.fontSize = '12px';
        detalle.textContent = `Ocupación: ${ocupacion}`;
        caja.append(detalle);
      }
      new Popup({ closeButton: true }).setLngLat(e.lngLat).setDOMContent(caja).addTo(m);
    });
    m.on('mouseenter', 'zonas-puntos', () => (m.getCanvas().style.cursor = 'pointer'));
    m.on('mouseleave', 'zonas-puntos', () => (m.getCanvas().style.cursor = ''));

    setMapa(m);
    return () => {
      m.remove();
      setMapa(null);
      setListo(false);
    };
  }, []);

  useEffect(() => {
    if (!mapa || !listo) return;
    (mapa.getSource(FUENTE) as GeoJSONSource | undefined)?.setData(zonas as never);
  }, [mapa, listo, zonas]);

  useEffect(() => {
    if (!mapa || !listo || !ubicacion) return;
    (mapa.getSource(FUENTE_UBICACION) as GeoJSONSource | undefined)?.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          properties: {},
          geometry: { type: 'Point', coordinates: [ubicacion.lng, ubicacion.lat] },
        },
      ],
    });
    mapa.flyTo({ center: [ubicacion.lng, ubicacion.lat], zoom: 14 });
  }, [mapa, listo, ubicacion]);

  return <div ref={contenedor} className="h-full w-full" role="region" aria-label="Mapa de zonas de riesgo y refugios" />;
}
