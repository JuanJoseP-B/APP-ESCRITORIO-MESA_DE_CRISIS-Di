import { useEffect, useRef } from 'react';
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import { etiquetaRadio, type AnilloGenerado } from '../domain/perimetro';
import { useTexto } from '../i18n/IdiomaProvider';
import './EtiquetaAnillo.css';

interface Opciones {
  readonly mapa: MapLibreMap | null;
  readonly listo: boolean;
  readonly anillos: readonly AnilloGenerado[];
}

/** Rotula cada anillo con su radio, en su punto más al norte. Son marcadores DOM porque el estilo base no trae tipografías de mapa. */
export function useEtiquetasAnillos({ mapa, listo, anillos }: Opciones): void {
  const { t, idioma } = useTexto();
  const marcadores = useRef<Marker[]>([]);

  useEffect(() => {
    if (!mapa || !listo) return;
    marcadores.current = anillos.map((a) => {
      const elemento = document.createElement('span');
      elemento.className = 'ag-etiqueta-anillo';
      elemento.dataset['anillo'] = a.anillo;
      elemento.textContent = etiquetaRadio(a.radioM, idioma);
      elemento.title = t(`anillo.${a.anillo}`);
      return new Marker({ element: elemento, anchor: 'bottom' }).setLngLat([a.norte.lng, a.norte.lat]).addTo(mapa);
    });
    return () => {
      for (const m of marcadores.current) m.remove();
      marcadores.current = [];
    };
  }, [mapa, listo, anillos, idioma, t]);
}
