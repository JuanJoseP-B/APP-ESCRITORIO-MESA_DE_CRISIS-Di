import { useCallback, useMemo, useState } from 'react';
import type { NuevoReporte } from '@argos/shared';
import { FormularioReporte } from './components/FormularioReporte';
import { ListaRefugios } from './components/ListaRefugios';
import { MapaPublico } from './components/MapaPublico';
import { zonasAFeatureCollection } from './domain/geojson';
import { useGeolocalizacion } from './hooks/useGeolocalizacion';
import { useZonasPublicasRealtime, useZonasRiesgoRealtime } from './hooks/useListaRealtime';
import { servicioDemo } from './services/servicioDemo';
import { crearServicioDesdeEntorno } from './services/supabaseClient';

type Pestana = 'mapa' | 'reportar';

export function App() {
  const servicio = useMemo(() => crearServicioDesdeEntorno() ?? servicioDemo, []);
  const esDemo = servicio === servicioDemo;
  const riesgo = useZonasRiesgoRealtime(servicio);
  const publicas = useZonasPublicasRealtime(servicio);
  const { resultado, solicitar } = useGeolocalizacion();
  const [pestana, setPestana] = useState<Pestana>('mapa');

  const zonas = useMemo(
    () => zonasAFeatureCollection(riesgo.datos, publicas.datos),
    [riesgo.datos, publicas.datos],
  );

  const enviar = useCallback(
    (reporte: NuevoReporte, foto: File | null) => servicio.enviarReporte(reporte, foto),
    [servicio],
  );

  const ubicacion = resultado.estado === 'ok' ? resultado.coordenadas : null;
  const hayRiesgoActivo = zonas.features.some((f) => f.properties.categoria === 'riesgo');

  return (
    <div className="flex h-full flex-col bg-base text-texto">
      <header className="flex items-center justify-between border-b border-linea bg-superficie px-3 py-2">
        <h1 className="text-base font-bold">ARGOS · Portal ciudadano</h1>
        <span
          className={`font-mono text-xs font-bold ${hayRiesgoActivo ? 'text-critico' : 'text-ok'}`}
          role="status"
        >
          {hayRiesgoActivo ? '● ZONAS DE RIESGO ACTIVAS' : '● SIN ALERTAS'}
        </span>
      </header>
      {esDemo && (
        <p role="alert" className="border-b border-linea bg-advertencia/15 px-3 py-1 font-mono text-xs font-bold">
          MODO DEMO: sin conexión a Supabase, los reportes no llegan a la Mesa de Crisis.
        </p>
      )}

      <main className="relative min-h-0 flex-1">
        <div className={pestana === 'mapa' ? 'flex h-full flex-col' : 'hidden'}>
          <div className="relative min-h-0 flex-1">
            <MapaPublico zonas={zonas} ubicacion={ubicacion} />
            <button
              type="button"
              onClick={solicitar}
              className="absolute bottom-3 right-3 min-h-11 border border-linea bg-superficie px-3 text-sm font-bold"
            >
              Mi ubicación
            </button>
          </div>
          <div className="max-h-[38%] overflow-y-auto border-t border-linea bg-superficie">
            <ListaRefugios
              zonas={publicas.datos}
              cargando={publicas.cargando}
              error={publicas.error ?? riesgo.error}
            />
          </div>
        </div>

        {pestana === 'reportar' && (
          <div className="h-full overflow-y-auto bg-base">
            <FormularioReporte
              geolocalizacion={resultado}
              onSolicitarUbicacion={solicitar}
              onEnviar={enviar}
            />
          </div>
        )}
      </main>

      <nav className="grid grid-cols-2 border-t border-linea bg-superficie" aria-label="Secciones">
        {(
          [
            ['mapa', 'Mapa'],
            ['reportar', 'Reportar'],
          ] as const
        ).map(([id, etiqueta]) => (
          <button
            key={id}
            type="button"
            onClick={() => setPestana(id)}
            aria-current={pestana === id ? 'page' : undefined}
            className={`min-h-12 text-sm font-bold uppercase tracking-wide ${
              pestana === id ? 'border-t-2 border-critico' : 'border-t-2 border-transparent'
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </nav>
    </div>
  );
}
