import { useEffect, useRef } from 'react';
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { Llamada, Prioridad } from '@argos/shared';
import { leerToken } from '@argos/ui';
import { esLlamadaNueva } from '../domain/entrantes';

interface EntradaRadar {
  readonly marcador: Marker;
  readonly elemento: HTMLElement;
}

const TOKEN_POR_PRIORIDAD: Record<Prioridad, string> = {
  P1: 'status-critical',
  P2: 'status-warning',
  P3: 'status-info',
  P4: 'text-muted',
};

export interface OpcionesRadar {
  readonly mapa: MapLibreMap | null;
  readonly listo: boolean;
  readonly llamadas?: readonly Llamada[];
  readonly ahora?: number;
  readonly reducirMovimiento?: boolean;
}

/**
 * Muestra 2–3 ondas concéntricas de radar sobre la ubicación de las llamadas entrantes recién llegadas.
 * Se colorean según la prioridad de la llamada (P1 crítico, P2 advertencia, P3 info, P4 neutro).
 */
export function useOndasRadarLlamadas({
  mapa,
  listo,
  llamadas,
  ahora,
  reducirMovimiento = false,
}: OpcionesRadar): void {
  const entradas = useRef(new Map<string, EntradaRadar>());

  useEffect(() => {
    if (!mapa || !listo || !llamadas || ahora === undefined) return;

    if (reducirMovimiento) {
      for (const [, entrada] of entradas.current) {
        entrada.marcador.remove();
      }
      entradas.current.clear();
      return;
    }

    const nuevas = llamadas.filter(
      (l) => l.incidenteId === null && l.estadoValidacion === 'No confirmado' && esLlamadaNueva(l, ahora),
    );
    const idsNuevas = new Set(nuevas.map((l) => l.id));

    for (const [id, entrada] of entradas.current) {
      if (!idsNuevas.has(id)) {
        entrada.marcador.remove();
        entradas.current.delete(id);
      }
    }

    for (const l of nuevas) {
      let entrada = entradas.current.get(l.id);
      const colorToken = leerToken(TOKEN_POR_PRIORIDAD[l.prioridad]);

      if (!entrada) {
        const elemento = document.createElement('div');
        elemento.className = 'ag-radar-contenedor';
        elemento.setAttribute('aria-hidden', 'true');
        elemento.style.setProperty('--color-prioridad', colorToken);

        for (let i = 0; i < 3; i++) {
          const onda = document.createElement('span');
          onda.className = 'ag-radar-onda';
          onda.style.borderColor = colorToken;
          onda.style.animationDelay = `${i * 350}ms`;
          elemento.appendChild(onda);
        }

        const marcador = new Marker({ element: elemento, anchor: 'center' })
          .setLngLat([l.ubicacion.lng, l.ubicacion.lat])
          .addTo(mapa);

        entrada = { marcador, elemento };
        entradas.current.set(l.id, entrada);
      } else {
        entrada.marcador.setLngLat([l.ubicacion.lng, l.ubicacion.lat]);
        entrada.elemento.style.setProperty('--color-prioridad', colorToken);
      }
    }
  }, [mapa, listo, llamadas, ahora, reducirMovimiento]);

  useEffect(() => {
    return () => {
      for (const [, entrada] of entradas.current) {
        entrada.marcador.remove();
      }
      entradas.current.clear();
    };
  }, []);
}
