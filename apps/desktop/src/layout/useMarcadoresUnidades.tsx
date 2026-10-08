import { useEffect, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { Marker, type Map as MapLibreMap } from 'maplibre-gl';
import type { EstadoSla } from '@argos/shared';
import type { UnidadMapa } from '../domain/unidadesMapa';
import { ContextoIdioma, useTexto } from '../i18n/IdiomaProvider';
import { MarcadorUnidad } from './MarcadorUnidad';

interface Entrada {
  readonly marcador: Marker;
  readonly raiz: Root;
}

interface Opciones {
  readonly mapa: MapLibreMap | null;
  readonly listo: boolean;
  readonly unidades: readonly UnidadMapa[];
  readonly seleccionadaId: string | null;
  /** Unidades dentro de una zona caliente: llevan la alerta en el marcador. */
  readonly enAlerta: ReadonlySet<string>;
  readonly resaltadaId: string | null;
  readonly onSeleccionar: (id: string) => void;
  /** SLA de las unidades con despacho en curso, por id de recurso. */
  readonly sla: ReadonlyMap<string, EstadoSla>;
  readonly reducirMovimiento: boolean;
}

/**
 * Dibuja una unidad como marcador DOM de MapLibre con un componente React dentro (glifo, indicativo, estado).
 * Cada marcador es su propia raíz de React, por eso se le pasa el idioma por contexto en cada render.
 */
export function useMarcadoresUnidades({ mapa, listo, unidades, seleccionadaId, enAlerta, resaltadaId, onSeleccionar, sla, reducirMovimiento }: Opciones): void {
  const idioma = useTexto();
  const entradas = useRef(new Map<string, Entrada>());
  const alSeleccionar = useRef(onSeleccionar);
  alSeleccionar.current = onSeleccionar;

  useEffect(() => {
    if (!mapa || !listo) return;
    const vigentes = new Set(unidades.map((u) => u.id));
    for (const [id, entrada] of entradas.current) {
      if (vigentes.has(id)) continue;
      entrada.marcador.remove();
      desmontar(entrada.raiz);
      entradas.current.delete(id);
    }
    for (const u of unidades) {
      let entrada = entradas.current.get(u.id);
      if (!entrada) {
        const elemento = document.createElement('div');
        const marcador = new Marker({ element: elemento, anchor: 'center' }).setLngLat([u.posicion.lng, u.posicion.lat]).addTo(mapa);
        entrada = { marcador, raiz: createRoot(elemento) };
        entradas.current.set(u.id, entrada);
      } else {
        entrada.marcador.setLngLat([u.posicion.lng, u.posicion.lat]);
      }
      entrada.raiz.render(
        <ContextoIdioma.Provider value={idioma}>
          <MarcadorUnidad
            unidad={u}
            seleccionada={u.id === seleccionadaId}
            alerta={enAlerta.has(u.id)}
            resaltada={u.id === resaltadaId}
            sla={sla.get(u.id)}
            reducirMovimiento={reducirMovimiento}
            onSeleccionar={(id) => alSeleccionar.current(id)}
          />
        </ContextoIdioma.Provider>,
      );
    }
  }, [mapa, listo, unidades, seleccionadaId, enAlerta, resaltadaId, idioma, sla, reducirMovimiento]);

  // Al desmontar el mapa se retiran todos los marcadores.
  useEffect(() => {
    const guardadas = entradas.current;
    return () => {
      for (const entrada of guardadas.values()) {
        entrada.marcador.remove();
        desmontar(entrada.raiz);
      }
      guardadas.clear();
    };
  }, [mapa]);
}

/** React no permite desmontar una raíz mientras renderiza otra: se difiere un turno. */
function desmontar(raiz: Root): void {
  queueMicrotask(() => raiz.unmount());
}
