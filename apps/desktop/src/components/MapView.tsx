import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import { TerraDraw, TerraDrawPolygonMode } from 'terra-draw';
import { TerraDrawMapLibreGLAdapter } from 'terra-draw-maplibre-gl-adapter';
import type { GeoJsonPolygon, Incidente, Posicion } from '@argos/shared';
import { incidentesAFeatureCollection } from '../domain/geojson';
import { construirPoligono } from '../domain/poligono';

const FUENTE = 'incidentes';
const CENTRO_INICIAL: [number, number] = [-70.65, -33.45];

/** Estilo base raster; sustituible con VITE_MAP_STYLE_URL (p. ej. un estilo de Mapbox/MapLibre propio). */
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

interface Props {
  readonly incidentes: readonly Incidente[];
  readonly seleccionadoId: string | null;
  readonly onSeleccionar: (id: string) => void;
  /** Activa el modo de trazado de polígono de zona de riesgo. */
  readonly dibujando: boolean;
  readonly onPoligono: (poligono: GeoJsonPolygon) => void;
  readonly onErrorDibujo: (mensaje: string) => void;
}

export function MapView({
  incidentes,
  seleccionadoId,
  onSeleccionar,
  dibujando,
  onPoligono,
  onErrorDibujo,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapLibreMap | null>(null);
  const [listo, setListo] = useState(false);
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;

  // Inicializa el mapa una sola vez.
  useEffect(() => {
    if (!contenedor.current) return;
    const estilo = (import.meta.env['VITE_MAP_STYLE_URL'] as string | undefined) ?? ESTILO_POR_DEFECTO;
    const m = new MapLibreMap({
      container: contenedor.current,
      style: estilo,
      center: CENTRO_INICIAL,
      zoom: 11,
    });
    m.on('load', () => {
      m.addSource(FUENTE, { type: 'geojson', data: incidentesAFeatureCollection([]) as never });
      m.addLayer({
        id: 'incidentes-relleno',
        type: 'fill',
        source: FUENTE,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
      });
      m.addLayer({
        id: 'incidentes-borde',
        type: 'line',
        source: FUENTE,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
      });
      m.addLayer({
        id: 'incidentes-puntos',
        type: 'circle',
        source: FUENTE,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 7,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
      for (const capa of ['incidentes-relleno', 'incidentes-puntos']) {
        m.on('click', capa, (e) => {
          const id = e.features?.[0]?.properties?.['id'];
          if (typeof id === 'string') alSeleccionar.current(id);
        });
      }
      setListo(true);
    });
    setMapa(m);
    return () => {
      setListo(false);
      setMapa(null);
      m.remove();
    };
  }, []);

  // Sincroniza incidentes con la fuente GeoJSON.
  useEffect(() => {
    if (!mapa || !listo) return;
    const fuente = mapa.getSource<GeoJSONSource>(FUENTE);
    fuente?.setData(incidentesAFeatureCollection(incidentes) as never);
  }, [mapa, listo, incidentes]);

  // Centra el mapa en el incidente seleccionado.
  useEffect(() => {
    if (!mapa || !listo || !seleccionadoId) return;
    const inc = incidentes.find((i) => i.id === seleccionadoId);
    if (!inc) return;
    const g = inc.geometria;
    const puntos: readonly Posicion[] = g.type === 'Point' ? [g.coordinates] : (g.coordinates[0] ?? []);
    const primero = puntos[0];
    if (!primero) return;
    const limites = puntos.reduce(
      (b, p) => b.extend([p[0], p[1]]),
      new LngLatBounds([primero[0], primero[1]], [primero[0], primero[1]]),
    );
    mapa.fitBounds(limites, { padding: 80, maxZoom: 15, duration: 600 });
  }, [mapa, listo, seleccionadoId, incidentes]);

  // Herramienta de dibujo de polígonos (Terra Draw).
  useEffect(() => {
    if (!mapa || !listo || !dibujando) return;
    const draw = new TerraDraw({
      adapter: new TerraDrawMapLibreGLAdapter({ map: mapa }),
      modes: [new TerraDrawPolygonMode()],
    });
    draw.start();
    draw.setMode('polygon');
    draw.on('finish', (id) => {
      const feature = draw.getSnapshotFeature(id);
      if (feature?.geometry.type !== 'Polygon') return;
      const anillo = (feature.geometry.coordinates[0] ?? []).map((c): Posicion => [c[0] ?? 0, c[1] ?? 0]);
      const resultado = construirPoligono(anillo);
      if (resultado.valido) onPoligono(resultado.poligono);
      else onErrorDibujo(resultado.error);
      draw.clear();
    });
    return () => {
      draw.stop();
    };
  }, [mapa, listo, dibujando, onPoligono, onErrorDibujo]);

  return <div ref={contenedor} className="h-full w-full" data-testid="mapa" />;
}
