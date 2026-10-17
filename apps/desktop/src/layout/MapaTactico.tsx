import { useCallback, useEffect, useRef, useState } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, type GeoJSONSource, type StyleSpecification } from 'maplibre-gl';
import MapboxDraw, { type EventoCambioModo, type EventoCrear, type ModoDibujo } from '@mapbox/mapbox-gl-draw';
import type { Anillo, Coordenadas, EstadoSla, Incidente, Llamada, Posicion, Reporte, ZonaPublica } from '@argos/shared';
import { duracion, leerToken, observarTema, opacidadZona } from '@argos/ui';
import {
  colorearFeatures,
  incidentesAFeatureCollection,
  reportesAFeatureCollection,
  type FeatureCollectionRutas,
  zonasAFeatureCollection,
} from '../domain/geojson';
import { pinturaBasemap } from '../domain/basemap';
import type { ObjetivoResaltado } from '../domain/analisisEspacial';
import type { EstadoMapa } from '../domain/arranque';
import type { PrevisualizacionAsesor } from '../domain/asesor';
import { CAPAS_POR_DEFECTO, alternarCapa, zonasVisibles, type CapaMapa } from '../domain/capasMapa';
import { anillosAFeatureCollection, type AnilloGenerado } from '../domain/perimetro';
import { figuraDesdeDibujo, type FiguraTrazada, type ModoTrazado } from '../domain/trazado';
import type { UnidadMapa } from '../domain/unidadesMapa';
import { LeyendaMapa } from './LeyendaMapa';
import { useEtiquetasAnillos } from './useEtiquetasAnillos';
import { useMarcadoresUnidades } from './useMarcadoresUnidades';
import { useOndasRadarLlamadas } from './useOndasRadarLlamadas';

const CAPA_BASE = 'base';
const FUENTE = 'incidentes';
const FUENTE_ZONAS = 'zonas-publicas';
const FUENTE_REPORTES = 'reportes';
const FUENTE_UBICACION = 'llamada-ubicacion';
const FUENTE_RUTAS = 'rutas';
const FUENTE_ANILLOS = 'anillos';
const FUENTE_VINCULACION = 'vinculacion-linea';
const FUENTE_ASESOR_PERIMETRO = 'asesor-perimetro';
const FUENTE_ASESOR_UNIDADES = 'asesor-unidades';
const CENTRO_INICIAL: [number, number] = [-77.2811, 1.2136];
const ZOOM_REPORTE = 15;
const VACIO = { type: 'FeatureCollection', features: [] } as const;
const SIN_UNIDADES: readonly UnidadMapa[] = [];
const TRAZO_ANILLO: readonly (readonly [Anillo, number[] | null])[] = [
  ['CALIENTE', null],
  ['TIBIA', [4, 2]],
  ['EVACUACION', [1, 2]],
];
const SIN_ALERTAS: ReadonlySet<string> = new Set();
const SIN_SLA: ReadonlyMap<string, EstadoSla> = new Map();
const SIN_ANILLOS: readonly AnilloGenerado[] = [];
const SIN_RUTAS: FeatureCollectionRutas = { type: 'FeatureCollection', features: [] };
const NADA = (): void => undefined;
const ZOOM_UNIDAD = 16;

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
  /** Incidente al que apunta el aviso de duplicados: se rodea con un anillo para que el operador lo ubique. */
  readonly resaltadoIncidenteId?: string | null;
  /** Unidades con posición; cada una se pinta como marcador con glifo de tipo, indicativo y estado. */
  readonly unidades?: readonly UnidadMapa[];
  readonly unidadSeleccionadaId?: string | null;
  readonly onSeleccionarUnidad?: (id: string) => void;
  /** Tramo que le falta a cada unidad en ruta; se dibuja como línea discontinua hasta el incidente. */
  readonly rutas?: FeatureCollectionRutas;
  /** Anillos de riesgo (caliente, tibia, evacuación) del incidente seleccionado, con su radio rotulado. */
  readonly anillos?: readonly AnilloGenerado[];
  /** Unidades dentro de la zona caliente: su marcador lleva la alerta. */
  readonly unidadesEnAlerta?: ReadonlySet<string>;
  /** Elemento señalado en el panel de análisis; se resalta en el mapa. */
  readonly resaltado?: ObjetivoResaltado | null;
  /** SLA de las unidades con despacho en curso, por id de recurso; su marcador lleva el cronómetro. */
  readonly sla?: ReadonlyMap<string, EstadoSla>;
  /** Menos movimiento: el cronómetro vencido no parpadea y se marca con rayas. */
  readonly reducirMovimiento?: boolean;
  /** Lo que sugiere el asesor (perímetro y unidades), en trazo discontinuo; `null` si su tarjeta está cerrada. */
  readonly previsualizacion?: PrevisualizacionAsesor | null;
  /** Llamadas de la consola para mostrar ondas de radar en las entrantes nuevas. */
  readonly llamadas?: readonly Llamada[];
  /** Hora de la consola (ms epoch). */
  readonly ahora?: number;
  /** Línea animada entre llamada e incidente al vincular. */
  readonly lineaVinculacion?: { readonly origen: Coordenadas; readonly destino: Coordenadas } | null;
  /** Avisa cuando el mapa termina de cargar o falla antes de lograrlo (la secuencia de arranque lo muestra). */
  readonly onEstado?: (estado: EstadoMapa) => void;
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
  resaltadoIncidenteId = null,
  unidades = SIN_UNIDADES,
  unidadSeleccionadaId = null,
  onSeleccionarUnidad = NADA,
  rutas = SIN_RUTAS,
  anillos = SIN_ANILLOS,
  unidadesEnAlerta = SIN_ALERTAS,
  resaltado = null,
  sla = SIN_SLA,
  reducirMovimiento = false,
  previsualizacion = null,
  llamadas,
  ahora,
  lineaVinculacion = null,
  onEstado,
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
  const alEstado = useRef(onEstado);
  alEstado.current = onEstado;
  // Sube cada vez que cambia el turno (crema/carbón) para repintar con los tokens del tema nuevo.
  const [versionTema, setVersionTema] = useState(0);
  // Capas que el operador enciende o apaga desde la leyenda.
  const [capas, setCapas] = useState(CAPAS_POR_DEFECTO);
  const alternarCapaMapa = useCallback((capa: CapaMapa) => setCapas((actuales) => alternarCapa(actuales, capa)), []);
  const unidadesVisibles = capas.unidades ? unidades : SIN_UNIDADES;
  const rutasVisibles = capas.unidades ? rutas : SIN_RUTAS;
  const anillosVisibles = capas.perimetros ? anillos : SIN_ANILLOS;
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
    // Un fallo de estilo o de teselas antes de `load` deja el mapa sin base: se dice, aunque `load` llegue después.
    let fallo = false;
    m.on('error', () => {
      if (fallo || m.loaded()) return;
      fallo = true;
      alEstado.current?.('ERROR');
    });
    m.on('load', () => {
      if (!fallo) alEstado.current?.('LISTO');
      // Los anillos van debajo de todo lo demás: zonas, incidentes y unidades quedan legibles encima.
      m.addSource(FUENTE_ANILLOS, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'anillos-relleno',
        type: 'fill',
        source: FUENTE_ANILLOS,
        paint: { 'fill-color': ['get', 'color'], 'fill-opacity': ['get', 'opacidad'] },
      });
      // Cada anillo con su trazo (continuo, discontinuo, punteado): se distinguen sin depender del color.
      for (const [anillo, trazo] of TRAZO_ANILLO) {
        m.addLayer({
          id: `anillos-borde-${anillo}`,
          type: 'line',
          source: FUENTE_ANILLOS,
          filter: ['==', ['get', 'id'], anillo],
          paint: { 'line-color': ['get', 'color'], 'line-width': 2, ...(trazo ? { 'line-dasharray': trazo } : {}) },
        });
      }
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
      // Anillos sobre el incidente resaltado (punto o polígono); el filtro por id se actualiza desde el efecto.
      m.addLayer({
        id: 'incidentes-resalte-punto',
        type: 'circle',
        source: FUENTE,
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'id'], '']],
        paint: {
          'circle-radius': 16,
          'circle-opacity': 0,
          'circle-stroke-color': leerToken('action-secondary'),
          'circle-stroke-width': 4,
        },
      });
      m.addLayer({
        id: 'incidentes-resalte-borde',
        type: 'line',
        source: FUENTE,
        filter: ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'id'], '']],
        paint: { 'line-color': leerToken('action-secondary'), 'line-width': 6 },
      });
      // Zona pública señalada desde el análisis: anillo sobre el punto o trazo grueso sobre el polígono o la línea.
      m.addLayer({
        id: 'zonas-resalte-punto',
        type: 'circle',
        source: FUENTE_ZONAS,
        filter: ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'id'], '']],
        paint: {
          'circle-radius': 14,
          'circle-opacity': 0,
          'circle-stroke-color': leerToken('action-secondary'),
          'circle-stroke-width': 4,
        },
      });
      m.addLayer({
        id: 'zonas-resalte-linea',
        type: 'line',
        source: FUENTE_ZONAS,
        filter: ['all', ['!=', ['geometry-type'], 'Point'], ['==', ['get', 'id'], '']],
        paint: { 'line-color': leerToken('action-secondary'), 'line-width': 6 },
      });
      m.addSource(FUENTE_RUTAS, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'rutas-linea',
        type: 'line',
        source: FUENTE_RUTAS,
        layout: { 'line-cap': 'butt' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [2, 2] },
      });
      // Previsualización del asesor: solo trazos discontinuos, sin relleno, para no esconder lo que ya hay en el mapa.
      m.addSource(FUENTE_ASESOR_PERIMETRO, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'asesor-perimetro-linea',
        type: 'line',
        source: FUENTE_ASESOR_PERIMETRO,
        paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [3, 2] },
      });
      m.addSource(FUENTE_ASESOR_UNIDADES, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'asesor-unidades-linea',
        type: 'line',
        source: FUENTE_ASESOR_UNIDADES,
        layout: { 'line-cap': 'butt' },
        paint: { 'line-color': ['get', 'color'], 'line-width': 3, 'line-dasharray': [1, 2] },
      });
      m.addSource(FUENTE_VINCULACION, { type: 'geojson', data: VACIO as never });
      m.addLayer({
        id: 'vinculacion-linea',
        type: 'line',
        source: FUENTE_VINCULACION,
        layout: { 'line-cap': 'round' },
        paint: { 'line-color': leerToken('action-primary'), 'line-width': 3, 'line-dasharray': [2, 2] },
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
    mapa
      .getSource<GeoJSONSource>(FUENTE_ZONAS)
      ?.setData(colorearFeatures(zonasAFeatureCollection(zonasVisibles(zonas, capas)), leerToken) as never);
  }, [mapa, listo, zonas, capas, versionTema]);

  useEffect(() => {
    if (!mapa || !listo) return;
    mapa
      .getSource<GeoJSONSource>(FUENTE_REPORTES)
      ?.setData(colorearFeatures(reportesAFeatureCollection(reportes, reporteSeleccionadoId), leerToken) as never);
  }, [mapa, listo, reportes, reporteSeleccionadoId, versionTema]);

  useEffect(() => {
    if (!mapa || !listo) return;
    mapa.getSource<GeoJSONSource>(FUENTE_RUTAS)?.setData(colorearFeatures(rutasVisibles, leerToken) as never);
  }, [mapa, listo, rutasVisibles, versionTema]);

  // Dash animado en las rutas de despacho (marching dash)
  useEffect(() => {
    if (!mapa || !listo || reducirMovimiento || rutasVisibles.features.length === 0) return;
    const dashSecuencia = [
      [0, 4, 3],
      [0.5, 4, 2.5],
      [1, 4, 2],
      [1.5, 4, 1.5],
      [2, 4, 1],
      [2.5, 4, 0.5],
      [3, 4, 0],
      [0, 0.5, 3.5, 3],
    ];
    let paso = 0;
    let animId: number;
    let cancelado = false;
    let ultimoTiempo = performance.now();
    const pasoMs = 80;

    const animar = (ahoraMs: number) => {
      if (cancelado) return;
      if (ahoraMs - ultimoTiempo >= pasoMs) {
        ultimoTiempo = ahoraMs;
        paso = (paso + 1) % dashSecuencia.length;
        if (mapa.getLayer('rutas-linea')) {
          mapa.setPaintProperty('rutas-linea', 'line-dasharray', dashSecuencia[paso]);
        }
      }
      animId = requestAnimationFrame(animar);
    };
    animId = requestAnimationFrame(animar);
    return () => {
      cancelado = true;
      cancelAnimationFrame(animId);
      if (mapa.getLayer('rutas-linea')) {
        mapa.setPaintProperty('rutas-linea', 'line-dasharray', [2, 2]);
      }
    };
  }, [mapa, listo, rutasVisibles.features.length, reducirMovimiento]);

  // Al resolver un incidente: los anillos se contraen, el marcador muestra ✓ y se desvanece
  const previosEstadosRef = useRef<Map<string, string>>(new Map());
  useEffect(() => {
    if (!mapa || !listo) return;
    for (const inc of incidentes) {
      const previo = previosEstadosRef.current.get(inc.id);
      if (previo && previo !== 'Resuelto' && inc.estado === 'Resuelto') {
        if (inc.geometria?.type === 'Point') {
          const [lng, lat] = inc.geometria.coordinates;
          const el = document.createElement('div');
          el.className = 'ag-marcador-resuelto';
          el.textContent = '✓';
          el.setAttribute('aria-hidden', 'true');
          const m = new Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(mapa);
          const dur = reducirMovimiento ? 80 : (duracion('slow') || 400);
          setTimeout(() => m.remove(), dur);
        }
        if (inc.id === seleccionadoId && !reducirMovimiento) {
          setPasoAnillos(2);
          setTimeout(() => setPasoAnillos(1), 75);
          setTimeout(() => setPasoAnillos(0), 150);
        }
      }
      previosEstadosRef.current.set(inc.id, inc.estado);
    }
  }, [mapa, listo, incidentes, seleccionadoId, reducirMovimiento]);

  // Perímetro y líneas hacia las unidades que sugiere el asesor mientras su tarjeta está abierta.
  useEffect(() => {
    if (!mapa || !listo) return;
    mapa.getSource<GeoJSONSource>(FUENTE_ASESOR_PERIMETRO)?.setData(colorearFeatures(previsualizacion?.perimetro ?? VACIO, leerToken) as never);
    mapa.getSource<GeoJSONSource>(FUENTE_ASESOR_UNIDADES)?.setData(colorearFeatures(previsualizacion?.unidades ?? VACIO, leerToken) as never);
  }, [mapa, listo, previsualizacion, versionTema]);

  // Expansión en secuencia de los anillos: 100 → 300 → 500 m con --dur-fast. Con reducirMovimiento aparecen todos.
  const [pasoAnillos, setPasoAnillos] = useState(3);
  useEffect(() => {
    if (anillosVisibles.length === 0) {
      setPasoAnillos(0);
      return;
    }
    if (reducirMovimiento) {
      setPasoAnillos(anillosVisibles.length);
      return;
    }
    setPasoAnillos(1);
    const d = duracion('fast') || 150;
    const t1 = setTimeout(() => setPasoAnillos(2), d);
    const t2 = setTimeout(() => setPasoAnillos(3), d * 2);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [anillosVisibles, reducirMovimiento]);

  // La opacidad de cada anillo parte de la del tema activo, así que se recalcula al cambiar de turno.
  useEffect(() => {
    if (!mapa || !listo) return;
    const anillosEscalonados = anillosVisibles.slice(0, pasoAnillos);
    mapa
      .getSource<GeoJSONSource>(FUENTE_ANILLOS)
      ?.setData(colorearFeatures(anillosAFeatureCollection(anillosEscalonados, opacidadZona()), leerToken) as never);
  }, [mapa, listo, anillosVisibles, pasoAnillos, versionTema]);
  useEtiquetasAnillos({ mapa, listo, anillos: anillosVisibles });

  // Caída con impacto del marcador al seleccionar un incidente nuevo (o al crearlo).
  const ultimoSeleccionado = useRef(seleccionadoId);
  const marcadorCaidaRef = useRef<Marker | null>(null);
  useEffect(() => {
    if (!mapa || !listo || !seleccionadoId || reducirMovimiento) return;
    if (seleccionadoId !== ultimoSeleccionado.current) {
      ultimoSeleccionado.current = seleccionadoId;
      const inc = incidentes.find((i) => i.id === seleccionadoId);
      if (inc?.geometria?.type === 'Point') {
        const [lng, lat] = inc.geometria.coordinates;
        if (marcadorCaidaRef.current) {
          marcadorCaidaRef.current.remove();
          marcadorCaidaRef.current = null;
        }
        const el = document.createElement('div');
        el.className = 'ag-marcador-caida';
        el.setAttribute('aria-hidden', 'true');
        const m = new Marker({ element: el, anchor: 'center' }).setLngLat([lng, lat]).addTo(mapa);
        marcadorCaidaRef.current = m;
        const dur = (duracion('base') || 240) + 60;
        const timer = setTimeout(() => {
          m.remove();
          if (marcadorCaidaRef.current === m) marcadorCaidaRef.current = null;
        }, dur);
        return () => clearTimeout(timer);
      }
    }
  }, [mapa, listo, seleccionadoId, incidentes, reducirMovimiento]);

  // Línea animada entre la llamada y el incidente al vincular duplicados.
  useEffect(() => {
    if (!mapa || !listo) return;
    const datos = lineaVinculacion
      ? {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: [
                  [lineaVinculacion.origen.lng, lineaVinculacion.origen.lat],
                  [lineaVinculacion.destino.lng, lineaVinculacion.destino.lat],
                ],
              },
            },
          ],
        }
      : VACIO;
    mapa.getSource<GeoJSONSource>(FUENTE_VINCULACION)?.setData(datos as never);
  }, [mapa, listo, lineaVinculacion]);

  // Resalta la zona señalada en el análisis (las unidades se resaltan en su propio marcador).
  useEffect(() => {
    if (!mapa || !listo) return;
    const id = resaltado?.tipo === 'zona' ? resaltado.id : '';
    mapa.setFilter('zonas-resalte-punto', ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'id'], id]]);
    mapa.setFilter('zonas-resalte-linea', ['all', ['!=', ['geometry-type'], 'Point'], ['==', ['get', 'id'], id]]);
  }, [mapa, listo, resaltado]);

  // Resalta el incidente candidato a duplicado.
  useEffect(() => {
    if (!mapa || !listo) return;
    const id = resaltadoIncidenteId ?? '';
    mapa.setFilter('incidentes-resalte-punto', ['all', ['==', ['geometry-type'], 'Point'], ['==', ['get', 'id'], id]]);
    mapa.setFilter('incidentes-resalte-borde', ['all', ['==', ['geometry-type'], 'Polygon'], ['==', ['get', 'id'], id]]);
  }, [mapa, listo, resaltadoIncidenteId]);

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
    mapa.setPaintProperty('incidentes-resalte-punto', 'circle-stroke-color', leerToken('action-secondary'));
    mapa.setPaintProperty('incidentes-resalte-borde', 'line-color', leerToken('action-secondary'));
    mapa.setPaintProperty('zonas-resalte-punto', 'circle-stroke-color', leerToken('action-secondary'));
    mapa.setPaintProperty('zonas-resalte-linea', 'line-color', leerToken('action-secondary'));
    mapa.setPaintProperty('llamada-ubicacion-anillo', 'circle-stroke-color', leerToken('action-secondary'));
    mapa.setPaintProperty('llamada-ubicacion-centro', 'circle-color', leerToken('action-secondary'));
    mapa.setPaintProperty('llamada-ubicacion-centro', 'circle-stroke-color', halo);
    mapa.setPaintProperty('vinculacion-linea', 'line-color', leerToken('action-primary'));
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

  const duracionVuelo = reducirMovimiento ? 0 : (duracion('slow') || 400);

  // Vuela al reporte elegido en la bandeja.
  useEffect(() => {
    if (!mapa || !listo || !foco) return;
    mapa.flyTo({ center: [foco.lng, foco.lat], zoom: Math.max(mapa.getZoom(), ZOOM_REPORTE), duration: duracionVuelo });
  }, [mapa, listo, foco, duracionVuelo]);

  // Centra el mapa en el incidente seleccionado.
  // Solo al elegir otro incidente o cambiar su geometría: una nota nueva en la bitácora no debe mover la cámara.
  const geometriaSeleccionada = incidentes.find((i) => i.id === seleccionadoId)?.geometria;
  const claveGeometria = JSON.stringify(geometriaSeleccionada ?? null);
  useEffect(() => {
    if (!mapa || !listo || !seleccionadoId) return;
    const g = geometriaSeleccionada;
    if (!g) return;
    const puntos: readonly Posicion[] = g.type === 'Point' ? [g.coordinates] : (g.coordinates[0] ?? []);
    const primero = puntos[0];
    if (!primero) return;
    if (g.type === 'Point') {
      mapa.flyTo({ center: [primero[0], primero[1]], zoom: Math.max(mapa.getZoom(), 15), duration: duracionVuelo });
    } else {
      const limites = puntos.reduce(
        (b, p) => b.extend([p[0], p[1]]),
        new LngLatBounds([primero[0], primero[1]], [primero[0], primero[1]]),
      );
      mapa.fitBounds(limites, { padding: 80, maxZoom: 15, duration: duracionVuelo });
    }
  }, [mapa, listo, seleccionadoId, claveGeometria, duracionVuelo]);

  useMarcadoresUnidades({
    mapa,
    listo,
    unidades: unidadesVisibles,
    seleccionadaId: unidadSeleccionadaId,
    enAlerta: unidadesEnAlerta,
    resaltadaId: resaltado?.tipo === 'unidad' ? resaltado.id : null,
    onSeleccionar: onSeleccionarUnidad,
    sla,
    reducirMovimiento,
  });

  useOndasRadarLlamadas({
    mapa,
    listo,
    llamadas,
    ahora,
    reducirMovimiento,
  });

  // Centra el mapa en la unidad elegida (en el mapa o en el tablero). Solo al cambiar de unidad: si no, la cámara
  // perseguiría a una unidad en ruta. Va después del efecto del incidente para que, con ambos a la vez, gane la unidad.
  const unidadesVigentes = useRef(unidades);
  unidadesVigentes.current = unidades;
  useEffect(() => {
    if (!mapa || !listo || !unidadSeleccionadaId) return;
    const u = unidadesVigentes.current.find((x) => x.id === unidadSeleccionadaId);
    if (u) mapa.flyTo({ center: [u.posicion.lng, u.posicion.lat], zoom: Math.max(mapa.getZoom(), ZOOM_UNIDAD), duration: duracionVuelo });
  }, [mapa, listo, unidadSeleccionadaId, duracionVuelo]);

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
        <LeyendaMapa capas={capas} onCambiarCapa={alternarCapaMapa} />
      </div>
    </div>
  );
}
