import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import MapboxDraw, { type EventoCambioModo, type EventoCrear, type ModoDibujo } from '@mapbox/mapbox-gl-draw';
import type { Coordenadas, Incidente, Posicion, Reporte, ZonaPublica } from '@argos/shared';
import { incidentesAFeatureCollection, reportesAFeatureCollection, zonasAFeatureCollection } from '../domain/geojson';
import { figuraDesdeDibujo, type FiguraTrazada, type ModoTrazado } from '../domain/trazado';

const FUENTE = 'incidentes';
const FUENTE_ZONAS = 'zonas-publicas';
const FUENTE_REPORTES = 'reportes';
const CENTRO_INICIAL: [number, number] = [-70.65, -33.45];
const ZOOM_REPORTE = 15;
const VACIO = { type: 'FeatureCollection', features: [] } as const;

const MODO_DRAW: Record<ModoTrazado, ModoDibujo> = { poligono: 'draw_polygon', linea: 'draw_line_string' };

/** mapbox-gl-draw emite sus eventos por el mapa, pero MapLibre solo tipa los propios. */
interface BusDibujo {
  on(tipo: 'draw.create', oyente: (e: EventoCrear) => void): unknown;
  on(tipo: 'draw.modechange', oyente: (e: EventoCambioModo) => void): unknown;
  off(tipo: 'draw.create', oyente: (e: EventoCrear) => void): unknown;
  off(tipo: 'draw.modechange', oyente: (e: EventoCambioModo) => void): unknown;
}

// mapbox-gl-draw asume las clases CSS de Mapbox GL; MapLibre usa el prefijo `maplibregl-`.
Object.assign(MapboxDraw.constants.classes, {
  CANVAS: 'maplibregl-canvas',
  CONTROL_BASE: 'maplibregl-ctrl',
  CONTROL_PREFIX: 'maplibregl-ctrl-',
  CONTROL_GROUP: 'maplibregl-ctrl-group',
  ATTRIBUTION: 'maplibregl-ctrl-attrib',
});

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
  readonly zonas: readonly ZonaPublica[];
  readonly reportes: readonly Reporte[];
  readonly seleccionadoId: string | null;
  readonly reporteSeleccionadoId: string | null;
  readonly onSeleccionar: (id: string) => void;
  /** Punto al que volar; cada objeto nuevo recentra la cámara (aunque repita coordenadas). */
  readonly foco: Coordenadas | null;
  /** Activa el modo de trazado (mapbox-gl-draw). */
  readonly dibujando: boolean;
  readonly modoTrazado: ModoTrazado;
  readonly onFigura: (figura: FiguraTrazada) => void;
  readonly onErrorDibujo: (mensaje: string) => void;
}

export function MapView({
  incidentes,
  zonas,
  reportes,
  seleccionadoId,
  reporteSeleccionadoId,
  onSeleccionar,
  foco,
  dibujando,
  modoTrazado,
  onFigura,
  onErrorDibujo,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapLibreMap | null>(null);
  const [listo, setListo] = useState(false);
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;
  const trazando = useRef(dibujando);
  trazando.current = dibujando;

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
      m.addSource(FUENTE_ZONAS, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'zonas-relleno',
        type: 'fill',
        source: FUENTE_ZONAS,
        filter: ['==', '$type', 'Polygon'],
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.2 },
      });
      m.addLayer({
        id: 'zonas-linea',
        type: 'line',
        source: FUENTE_ZONAS,
        filter: ['in', '$type', 'Polygon', 'LineString'],
        paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 1] },
      });
      m.addLayer({
        id: 'zonas-puntos',
        type: 'circle',
        source: FUENTE_ZONAS,
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': 6,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 2,
        },
      });
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
      m.addSource(FUENTE_REPORTES, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'reportes-puntos',
        type: 'circle',
        source: FUENTE_REPORTES,
        paint: {
          'circle-color': ['get', 'color'],
          'circle-radius': ['case', ['get', 'seleccionado'], 9, 5],
          'circle-stroke-color': '#FFB300',
          'circle-stroke-width': ['case', ['get', 'seleccionado'], 4, 2],
        },
      });
      for (const capa of ['incidentes-relleno', 'incidentes-puntos']) {
        m.on('click', capa, (e) => {
          // Mientras se traza, los clics son vértices: no deben cambiar el incidente seleccionado.
          if (trazando.current) return;
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

  // Sincroniza zonas públicas (refugios y figuras trazadas) y reportes pendientes.
  useEffect(() => {
    if (!mapa || !listo) return;
    mapa.getSource<GeoJSONSource>(FUENTE_ZONAS)?.setData(zonasAFeatureCollection(zonas) as never);
  }, [mapa, listo, zonas]);

  useEffect(() => {
    if (!mapa || !listo) return;
    mapa
      .getSource<GeoJSONSource>(FUENTE_REPORTES)
      ?.setData(reportesAFeatureCollection(reportes, reporteSeleccionadoId) as never);
  }, [mapa, listo, reportes, reporteSeleccionadoId]);

  // Vuela al reporte elegido en la bandeja.
  useEffect(() => {
    if (!mapa || !listo || !foco) return;
    mapa.flyTo({ center: [foco.lng, foco.lat], zoom: Math.max(mapa.getZoom(), ZOOM_REPORTE), duration: 800 });
  }, [mapa, listo, foco]);

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

  // Herramienta de dibujo (mapbox-gl-draw): el control solo existe mientras se traza, para que
  // fuera de ese modo no intercepte los clics de selección sobre el mapa.
  useEffect(() => {
    if (!mapa || !listo || !dibujando) return;
    const modo = MODO_DRAW[modoTrazado];
    const draw = new MapboxDraw({ displayControlsDefault: false, defaultMode: modo });
    mapa.addControl(draw);
    const lienzo = mapa.getCanvas();
    lienzo.style.cursor = 'crosshair';
    let terminado = false;

    const alCrear = (e: EventoCrear) => {
      const dibujada = e.features[0];
      if (!dibujada) return;
      const resultado = figuraDesdeDibujo(dibujada.geometry);
      if (resultado.valido) {
        terminado = true;
        onFigura(resultado.figura);
      } else {
        onErrorDibujo(resultado.error);
      }
    };
    // Tras una figura inválida o cancelar con Escape, draw vuelve a `simple_select`: se retoma el trazado.
    const alCambiarModo = (e: EventoCambioModo) => {
      if (terminado || e.mode === modo) return;
      draw.deleteAll();
      draw.changeMode(modo);
    };
    const bus = mapa as unknown as BusDibujo;
    bus.on('draw.create', alCrear);
    bus.on('draw.modechange', alCambiarModo);
    return () => {
      bus.off('draw.create', alCrear);
      bus.off('draw.modechange', alCambiarModo);
      lienzo.style.cursor = '';
      mapa.removeControl(draw);
    };
  }, [mapa, listo, dibujando, modoTrazado, onFigura, onErrorDibujo]);

  return <div ref={contenedor} className="h-full w-full" data-testid="mapa" />;
}
