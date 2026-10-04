import { useCallback, useEffect, useMemo, useState } from 'react';
import { Login } from './components/Login';
import { MapView } from './components/MapView';
import { PanelMesa } from './components/PanelMesa';
import { PanelRecursos } from './components/PanelRecursos';
import { PanelRefugios } from './components/PanelRefugios';
import { useAccionesOperador } from './hooks/useAccionesOperador';
import {
  useIncidentesRealtime,
  useRecursosRealtime,
  useReportesRealtime,
  useZonasPublicasRealtime,
} from './hooks/useListaRealtime';
import { crearServicioDesdeEntorno, type ServicioMesa, type SesionOperador } from './services/supabaseClient';
import { servicioDemo } from './services/servicioDemo';

function Mesa({ servicio, onCerrarSesion }: { readonly servicio: ServicioMesa; readonly onCerrarSesion: () => void }) {
  const incidentes = useIncidentesRealtime(servicio);
  const reportes = useReportesRealtime(servicio);
  const recursos = useRecursosRealtime(servicio);
  const zonas = useZonasPublicasRealtime(servicio);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [dibujando, setDibujando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const acciones = useAccionesOperador({
    servicio,
    incidentes: incidentes.datos,
    seleccionadoId,
    alSeleccionar: setSeleccionadoId,
    alAvisar: setAviso,
  });

  const { guardarPoligono } = acciones;
  const alPoligono = useCallback(
    (p: Parameters<typeof guardarPoligono>[0]) => {
      setDibujando(false);
      guardarPoligono(p);
    },
    [guardarPoligono],
  );
  const alErrorDibujo = useCallback((mensaje: string) => setAviso(mensaje), []);

  const mensaje = aviso ?? incidentes.error ?? recursos.error ?? zonas.error ?? reportes.error;

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
          if (!dibujando && !seleccionadoId) {
            setAviso('Selecciona un incidente antes de trazar su zona de riesgo');
            return;
          }
          setDibujando((d) => !d);
        }}
        onConfirmarReporte={acciones.confirmarReporte}
        onDescartarReporte={acciones.descartarReporte}
        onCambiarEstadoIncidente={acciones.cambiarEstadoIncidente}
        onCerrarSesion={onCerrarSesion}
      >
        <PanelRecursos
          recursos={recursos.datos}
          incidenteSeleccionadoId={seleccionadoId}
          onCambiarEstado={acciones.cambiarEstadoRecurso}
        />
        <PanelRefugios zonas={zonas.datos} onCambiarOcupacion={acciones.cambiarOcupacion} />
      </PanelMesa>
      <main className="relative flex-1">
        <MapView
          incidentes={incidentes.datos}
          seleccionadoId={seleccionadoId}
          onSeleccionar={setSeleccionadoId}
          dibujando={dibujando}
          onPoligono={alPoligono}
          onErrorDibujo={alErrorDibujo}
        />
        {mensaje && (
          <p role="status" className="absolute bottom-3 left-3 border border-linea bg-superficie px-2 py-1 font-mono text-xs">
            {mensaje}
          </p>
        )}
      </main>
    </div>
  );
}

/** Sin credenciales de Supabase se usa un servicio local de ejemplo; con ellas se exige login de operador. */
export function App() {
  const servicio = useMemo(() => crearServicioDesdeEntorno() ?? servicioDemo, []);
  const [sesion, setSesion] = useState<SesionOperador | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    servicio.sesionActual().then(
      (s) => activo && setSesion(s),
      () => activo && setSesion(null),
    );
    return () => {
      activo = false;
    };
  }, [servicio]);

  const iniciarSesion = useCallback(
    async (email: string, password: string) => {
      setError(null);
      try {
        const s = await servicio.iniciarSesion(email, password);
        if (!s.esOperador) {
          await servicio.cerrarSesion();
          setError('Esta cuenta no tiene rol de operador');
          return;
        }
        setSesion(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido');
      }
    },
    [servicio],
  );

  const cerrarSesion = useCallback(() => {
    void servicio.cerrarSesion().finally(() => setSesion(null));
  }, [servicio]);

  if (sesion === undefined) return null;
  if (!sesion?.esOperador) return <Login onIniciarSesion={iniciarSesion} error={error} />;
  return <Mesa servicio={servicio} onCerrarSesion={cerrarSesion} />;
}
