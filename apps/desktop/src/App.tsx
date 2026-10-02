import { useCallback, useMemo, useState } from 'react';
import type { GeoJsonPolygon } from '@argos/shared';
import { MapView } from './components/MapView';
import { PanelMesa } from './components/PanelMesa';
import { useIncidentesRealtime, useReportesRealtime } from './hooks/useListaRealtime';
import { crearServicioDesdeEntorno, type ServicioMesa } from './services/supabaseClient';
import { servicioDemo } from './services/servicioDemo';

/** Sin credenciales de Supabase (Fase 1 pendiente) se usa un servicio local de ejemplo. */
function Mesa({ servicio }: { readonly servicio: ServicioMesa }) {
  const incidentes = useIncidentesRealtime(servicio);
  const reportes = useReportesRealtime(servicio);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [dibujando, setDibujando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  // Por ahora el polígono trazado se muestra como aviso; persistirlo requiere el backend (Fase 1).
  const alPoligono = useCallback((p: GeoJsonPolygon) => {
    setDibujando(false);
    setAviso(`Zona trazada con ${p.coordinates[0]?.length ?? 0} puntos`);
  }, []);
  const alErrorDibujo = useCallback((mensaje: string) => setAviso(mensaje), []);

  return (
    <div className="flex h-screen">
      <PanelMesa
        incidentes={incidentes.datos}
        reportes={reportes.datos}
        seleccionadoId={seleccionadoId}
        onSeleccionar={setSeleccionadoId}
        dibujando={dibujando}
        onAlternarDibujo={() => {
          setAviso(null);
          setDibujando((d) => !d);
        }}
      />
      <main className="relative flex-1">
        <MapView
          incidentes={incidentes.datos}
          seleccionadoId={seleccionadoId}
          onSeleccionar={setSeleccionadoId}
          dibujando={dibujando}
          onPoligono={alPoligono}
          onErrorDibujo={alErrorDibujo}
        />
        {(aviso ?? incidentes.error) && (
          <p className="absolute bottom-3 left-3 border border-linea bg-superficie px-2 py-1 font-mono text-xs">
            {aviso ?? incidentes.error}
          </p>
        )}
      </main>
    </div>
  );
}

export function App() {
  const servicio = useMemo(() => crearServicioDesdeEntorno() ?? servicioDemo, []);
  return <Mesa servicio={servicio} />;
}
