import { useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import MapboxDraw, { type EventoCambioModo, type EventoCrear, type ModoDibujo } from '@mapbox/mapbox-gl-draw';
import type { Coordenadas, Incidente, Posicion, Reporte, ZonaPublica } from '@argos/shared';
import { leerToken, observarTema } from '@argos/ui';
import {
  colorearFeatures,
  incidentesAFeatureCollection,
  reportesAFeatureCollection,
  zonasAFeatureCollection,
} from '../domain/geojson';
import { pinturaBasemap } from '../domain/basemap';
import { figuraDesdeDibujo, type FiguraTrazada, type ModoTrazado } from '../domain/trazado';
import { LeyendaMapa } from './LeyendaMapa';

const CAPA_BASE = 'base';
const FUENTE = 'incidentes';
const FUENTE_ZONAS = 'zonas-publicas';
const FUENTE_REPORTES = 'reportes';
const FUENTE_UBICACION = 'llamada-ubicacion';
const CENTRO_INICIAL: [number, number] = [-77.2811, 1.2136];
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
  /** Ubicación de la llamada que se está registrando; se marca con una mira en el mapa. */
  readonly ubicacionLlamada?: Coordenadas | null;
  /** Si se pasa, un clic en el mapa fija la ubicación (y no selecciona incidentes). Solo con el formulario abierto. */
  readonly onClicUbicacion?: (ubicacion: Coordenadas) => void;
}

export function MapaTactico({
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
  ubicacionLlamada = null,
  onClicUbicacion,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [mapa, setMapa] = useState<MapLibreMap | null>(null);
  const [listo, setListo] = useState(false);
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;
  const trazando = useRef(dibujando);
  trazando.current = dibujando;
  const alUbicar = useRef(onClicUbicacion);
  alUbicar.current = onClicUbicacion;
  // Sube cada vez que cambia el turno (crema/carbón) para repintar con los tokens del tema nuevo.
  const [versionTema, setVersionTema] = useState(0);
  useEffect(() => observarTema(() => setVersionTema((v) => v + 1)), []);

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
          'circle-stroke-color': leerToken('map-marker-halo'),
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
          'circle-stroke-color': leerToken('map-marker-halo'),
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
          'circle-stroke-color': leerToken('status-warning'),
          'circle-stroke-width': ['case', ['get', 'seleccionado'], 4, 2],
        },
      });
      m.addSource(FUENTE_UBICACION, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'llamada-ubicacion-anillo',
        type: 'circle',
        source: FUENTE_UBICACION,
        paint: {
          'circle-radius': 12,
          'circle-opacity': 0,
          'circle-stroke-color': leerToken('action-secondary'),
          'circle-stroke-width': 3,
        },
      });
      m.addLayer({
        id: 'llamada-ubicacion-centro',
        type: 'circle',
        source: FUENTE_UBICACION,
        paint: {
          'circle-radius': 4,
          'circle-color': leerToken('action-secondary'),
          'circle-stroke-color': leerToken('map-marker-halo'),
          'circle-stroke-width': 2,
        },
      });
      m.on('click', (e) => {
        // Con el formulario de llamada abierto el clic fija la ubicación; mientras se traza, son vértices.
        if (trazando.current) return;
        alUbicar.current?.({ lat: e.lngLat.lat, lng: e.lngLat.lng });
      });
      for (const capa of ['incidentes-relleno', 'incidentes-puntos']) {
        m.on('click', capa, (e) => {
          // Mientras se traza, los clics son vértices; con el formulario abierto fijan la ubicación.
          if (trazando.current || alUbicar.current) return;
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

  // Al plegar o expandir la cola y el detalle cambia el ancho del mapa: el lienzo debe redimensionarse.
  useEffect(() => {
    const el = contenedor.current;
    if (!mapa || !el || typeof ResizeObserver === 'undefined') return;
    const observador = new ResizeObserver(() => mapa.resize());
    observador.observe(el);
    return () => observador.disconnect();
  }, [mapa]);

  // Sincroniza incidentes con la fuente GeoJSON.
  useEffect(() => {
    if (!mapa || !listo) return;
    const fuente = mapa.getSource<GeoJSONSource>(FUENTE);
    fuente?.setData(colorearFeatures(incidentesAFeatureCollection(incidentes), leerToken) as never);
  }, [mapa, listo, incidentes, versionTema]);

  // Sincroniza zonas públicas (refugios y figuras trazadas) y reportes pendientes.
  useEffect(() => {
    if (!mapa || !listo) return;
    mapa.getSource<GeoJSONSource>(FUENTE_ZONAS)?.setData(colorearFeatures(zonasAFeatureCollection(zonas), leerToken) as never);
  }, [mapa, listo, zonas, versionTema]);

  useEffect(() => {
    if (!mapa || !listo) return;
    mapa
      .getSource<GeoJSONSource>(FUENTE_REPORTES)
      ?.setData(colorearFeatures(reportesAFeatureCollection(reportes, reporteSeleccionadoId), leerToken) as never);
  }, [mapa, listo, reportes, reporteSeleccionadoId, versionTema]);

  // Mira de la ubicación de la llamada en curso.
  useEffect(() => {
    if (!mapa || !listo) return;
    const datos = ubicacionLlamada
      ? {
          type: 'FeatureCollection',
          features: [{ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [ubicacionLlamada.lng, ubicacionLlamada.lat] } }],
        }
      : VACIO;
    mapa.getSource<GeoJSONSource>(FUENTE_UBICACION)?.setData(datos as never);
  }, [mapa, listo, ubicacionLlamada]);

  // Cursor de mira mientras el clic fija la ubicación (el trazado pone el suyo).
  const capturandoUbicacion = onClicUbicacion !== undefined;
  useEffect(() => {
    if (!mapa || !listo || dibujando || !capturandoUbicacion) return;
    const lienzo = mapa.getCanvas();
    lienzo.style.cursor = 'crosshair';
    return () => {
      lienzo.style.cursor = '';
    };
  }, [mapa, listo, dibujando, capturandoUbicacion]);

  // Los trazos de los marcadores dependen del tema: se reasignan al cambiar de turno.
  useEffect(() => {
    if (!mapa || !listo) return;
    const halo = leerToken('map-marker-halo');
    mapa.setPaintProperty('zonas-puntos', 'circle-stroke-color', halo);
    mapa.setPaintProperty('incidentes-puntos', 'circle-stroke-color', halo);
    mapa.setPaintProperty('reportes-puntos', 'circle-stroke-color', leerToken('status-warning'));
    mapa.setPaintProperty('llamada-ubicacion-anillo', 'circle-stroke-color', leerToken('action-secondary'));
    mapa.setPaintProperty('llamada-ubicacion-centro', 'circle-color', leerToken('action-secondary'));
    mapa.setPaintProperty('llamada-ubicacion-centro', 'circle-stroke-color', halo);
  }, [mapa, listo, versionTema]);

  // Basemap desaturado: la pintura depende del turno activo.
  useEffect(() => {
    if (!mapa || !listo || !mapa.getLayer(CAPA_BASE)) return;
    const pintura = pinturaBasemap(document.documentElement.dataset['theme']);
    mapa.setPaintProperty(CAPA_BASE, 'raster-saturation', pintura['raster-saturation']);
    mapa.setPaintProperty(CAPA_BASE, 'raster-contrast', pintura['raster-contrast']);
    mapa.setPaintProperty(CAPA_BASE, 'raster-brightness-min', pintura['raster-brightness-min']);
    mapa.setPaintProperty(CAPA_BASE, 'raster-brightness-max', pintura['raster-brightness-max']);
  }, [mapa, listo, versionTema]);

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

  return (
    <div className="relative h-full w-full">
      <div ref={contenedor} className="h-full w-full" data-testid="mapa" />
      <div className="absolute bottom-4 right-4 z-map-overlay">
        <LeyendaMapa />
      </div>
    </div>
  );
}
