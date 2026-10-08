import { useEffect, useRef } from 'react';
import { Map as MapLibreMap, Marker, NavigationControl } from 'maplibre-gl';
import type { Coordenadas } from '@argos/shared';
import { CENTRO_INICIAL, estiloMapa } from '../mapa/estiloBase';

interface Props {
  readonly ubicacion: Coordenadas | null;
  /** Se invoca al pulsar el mapa o al soltar el marcador arrastrado. */
  readonly onCambiar: (coordenadas: Coordenadas) => void;
}

function crearElementoMarcador(): HTMLDivElement {
  const el = document.createElement('div');
  el.setAttribute('aria-label', 'Ubicación del incidente (arrastra para ajustar)');
  el.style.cssText =
    'width:22px;height:22px;background:#e53935;border:3px solid #fff;box-shadow:0 0 0 2px #0f172a;cursor:grab;';
  return el;
}

/** Mapa compacto: la ubicación llega por GPS o por pulsación, y el marcador se arrastra para afinarla. */
export function SelectorUbicacion({ ubicacion, onCambiar }: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const mapa = useRef<MapLibreMap | null>(null);
  const marcador = useRef<Marker | null>(null);
  const alCambiar = useRef(onCambiar);
  /** Última posición fijada desde el propio mapa; evita recentrar la cámara bajo el dedo del usuario. */
  const interna = useRef<Coordenadas | null>(null);

  useEffect(() => {
    alCambiar.current = onCambiar;
  }, [onCambiar]);

  useEffect(() => {
    if (!contenedor.current) return;
    const m = new MapLibreMap({
      container: contenedor.current,
      style: estiloMapa(),
      center: CENTRO_INICIAL,
      zoom: 11,
    });
    m.addControl(new NavigationControl({ showCompass: false }), 'top-right');

    const fijar = (lng: number, lat: number) => {
      interna.current = { lat, lng };
      alCambiar.current({ lat, lng });
    };

    const mk = new Marker({ element: crearElementoMarcador(), draggable: true });
    mk.on('dragend', () => {
      const { lng, lat } = mk.getLngLat();
      fijar(lng, lat);
    });
    m.on('click', (e) => fijar(e.lngLat.lng, e.lngLat.lat));

    mapa.current = m;
    marcador.current = mk;
    return () => {
      mk.remove();
      m.remove();
      mapa.current = null;
      marcador.current = null;
    };
  }, []);

  useEffect(() => {
    const m = mapa.current;
    const mk = marcador.current;
    if (!m || !mk || !ubicacion) return;
    mk.setLngLat([ubicacion.lng, ubicacion.lat]).addTo(m);
    const esInterna = interna.current?.lat === ubicacion.lat && interna.current.lng === ubicacion.lng;
    if (!esInterna) m.easeTo({ center: [ubicacion.lng, ubicacion.lat], zoom: Math.max(m.getZoom(), 16) });
  }, [ubicacion]);

  return (
    <div
      ref={contenedor}
      role="region"
      aria-label="Mapa para ajustar la ubicación del incidente"
      className="h-56 w-full border border-linea"
    />
  );
}
