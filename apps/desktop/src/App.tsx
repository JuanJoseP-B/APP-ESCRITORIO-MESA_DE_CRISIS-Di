import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@argos/ui';
import { Login } from './components/Login';
import { MapaTactico } from './layout/MapaTactico';
import { useAccionesOperador } from './hooks/useAccionesOperador';
import {
  useIncidentesRealtime,
  useRecursosRealtime,
  useReportesRealtime,
  useZonasPublicasRealtime,
} from './hooks/useListaRealtime';
import { useAtajos } from './hooks/useAtajos';
import { usePanelColapsable } from './hooks/usePanelColapsable';
import { useReloj } from './hooks/useReloj';
import type { Coordenadas, Reporte } from '@argos/shared';
import { dividirCola, moverSeleccion } from './domain/cola';
import { estadoEnlace } from './domain/conexion';
import { MODOS_TRAZADO, type ModoTrazado } from './domain/trazado';
import { BarraEstado } from './layout/BarraEstado';
import { ColaIncidentes } from './layout/ColaIncidentes';
import { GrillaTactica } from './layout/GrillaTactica';
import { PanelDetalle } from './layout/PanelDetalle';
import { TableroUnidades } from './layout/TableroUnidades';
import { crearServicioDesdeEntorno, type ServicioMesa, type SesionOperador } from './services/supabaseClient';
import { servicioDemo } from './services/servicioDemo';
import { aplicarTema, temaGuardado, type Tema } from './tema';

const ETIQUETA_MODO: Record<ModoTrazado, string> = { poligono: 'Polígono', linea: 'Línea' };

function Mesa({
  servicio,
  operador,
  onCerrarSesion,
}: {
  readonly servicio: ServicioMesa;
  readonly operador: string;
  readonly onCerrarSesion: () => void;
}) {
  const incidentes = useIncidentesRealtime(servicio);
  const reportes = useReportesRealtime(servicio);
  const recursos = useRecursosRealtime(servicio);
  const zonas = useZonasPublicasRealtime(servicio);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [reporteSeleccionadoId, setReporteSeleccionadoId] = useState<string | null>(null);
  const [foco, setFoco] = useState<Coordenadas | null>(null);
  const [dibujando, setDibujando] = useState(false);
  const [modoTrazado, setModoTrazado] = useState<ModoTrazado>('poligono');
  const [aviso, setAviso] = useState<string | null>(null);
  const [tema, setTema] = useState<Tema>(temaGuardado);
  useEffect(() => aplicarTema(tema), [tema]);
  const alternarTema = useCallback(() => setTema((actual) => (actual === 'crema' ? 'carbon' : 'crema')), []);

  const [desfaseMs, setDesfaseMs] = useState(0);
  useEffect(() => {
    let activo = true;
    servicio.desfaseHoraServidorMs().then(
      (d) => activo && setDesfaseMs(d),
      () => undefined,
    );
    return () => {
      activo = false;
    };
  }, [servicio]);
  const ahora = useReloj(desfaseMs);

  const panelCola = usePanelColapsable('cola');
  const panelDetalle = usePanelColapsable('detalle');
  const { expandir: expandirDetalle } = panelDetalle;
  // Elegir un incidente abre el detalle: ahí vive el despacho.
  useEffect(() => {
    if (seleccionadoId) expandirDetalle();
  }, [seleccionadoId, expandirDetalle]);

  const acciones = useAccionesOperador({
    servicio,
    incidentes: incidentes.datos,
    seleccionadoId,
    alSeleccionar: setSeleccionadoId,
    alAvisar: setAviso,
  });

  const { guardarTrazado } = acciones;
  const alFigura = useCallback(
    (f: Parameters<typeof guardarTrazado>[0]) => {
      setDibujando(false);
      guardarTrazado(f);
    },
    [guardarTrazado],
  );
  // Objeto nuevo en cada clic: el mapa vuelve a centrar aunque se repita el mismo reporte.
  const alSeleccionarReporte = useCallback((r: Reporte) => {
    setReporteSeleccionadoId(r.id);
    setFoco({ lat: r.lat, lng: r.lng });
  }, []);
  const incidenteSeleccionado = incidentes.datos.find((i) => i.id === seleccionadoId) ?? null;
  const alErrorDibujo = useCallback((mensaje: string) => setAviso(mensaje), []);

  const ordenCola = useMemo(() => dividirCola(incidentes.datos).activos.map((i) => i.id), [incidentes.datos]);
  useAtajos({
    j: () => setSeleccionadoId((actual) => moverSeleccion(ordenCola, actual, 1)),
    k: () => setSeleccionadoId((actual) => moverSeleccion(ordenCola, actual, -1)),
    Escape: () => setDibujando(false),
  });

  const enlace = estadoEnlace([incidentes, reportes, recursos, zonas]);
  const mensaje = aviso ?? incidentes.error ?? recursos.error ?? zonas.error ?? reportes.error;

  const mapa = (
    <>
      <MapaTactico
        incidentes={incidentes.datos}
        zonas={zonas.datos}
        reportes={reportes.datos}
        seleccionadoId={seleccionadoId}
        reporteSeleccionadoId={reporteSeleccionadoId}
        onSeleccionar={setSeleccionadoId}
        foco={foco}
        dibujando={dibujando}
        modoTrazado={modoTrazado}
        onFigura={alFigura}
        onErrorDibujo={alErrorDibujo}
      />
      <div className="absolute left-4 top-4 z-toolbar flex flex-col gap-2">
        <Button
          size="sm"
          variant={dibujando ? 'secondary' : 'ghost'}
          className="border border-border-strong bg-surface-panel shadow-overlay"
          aria-pressed={dibujando}
          onClick={() => {
            setAviso(null);
            setDibujando((d) => !d);
          }}
        >
          {dibujando ? 'Cancelar trazado' : 'Trazar zona'}
        </Button>
        {dibujando && (
          <div className="border border-border-strong bg-surface-panel p-3 shadow-overlay">
            <p className="font-mono text-overline uppercase text-text-primary">Trazar figura</p>
            <div role="group" aria-label="Figura a trazar" className="mt-2 flex gap-1">
              {MODOS_TRAZADO.map((m) => (
                <Button key={m} size="sm" variant={m === modoTrazado ? 'secondary' : 'ghost'} aria-pressed={m === modoTrazado} onClick={() => setModoTrazado(m)}>
                  {ETIQUETA_MODO[m]}
                </Button>
              ))}
            </div>
            <p className="mt-2 max-w-64 font-ui text-body-sm text-text-secondary">
              {modoTrazado === 'poligono' && incidenteSeleccionado
                ? `Destino: zona de riesgo de "${incidenteSeleccionado.titulo}".`
                : 'Destino: zonas públicas (Bloqueo de Vía).'}{' '}
              Clic para añadir vértices; doble clic o Enter para terminar.
            </p>
          </div>
        )}
      </div>
      {mensaje && (
        <p role="status" className="absolute bottom-4 left-4 z-toolbar border border-border-strong bg-surface-panel px-3 py-2 font-mono text-data-sm text-text-primary shadow-overlay">
          <span aria-hidden="true" className="mr-2 text-status-info">◆</span>
          {mensaje}
        </p>
      )}
    </>
  );

  return (
    <GrillaTactica
      panelCola={panelCola}
      panelDetalle={panelDetalle}
      barra={
        <BarraEstado
          hora={ahora}
          turno={tema}
          onAlternarTurno={alternarTema}
          operador={operador}
          enlace={enlace}
          onCerrarSesion={onCerrarSesion}
        />
      }
      cola={
        <ColaIncidentes
          incidentes={incidentes.datos}
          recursos={recursos.datos}
          reportes={reportes.datos}
          ahora={ahora}
          seleccionadoId={seleccionadoId}
          onSeleccionar={setSeleccionadoId}
          reporteSeleccionadoId={reporteSeleccionadoId}
          onSeleccionarReporte={alSeleccionarReporte}
          onConfirmarReporte={acciones.confirmarReporte}
          onDescartarReporte={acciones.descartarReporte}
        />
      }
      mapa={mapa}
      detalle={
        <PanelDetalle
          incidente={incidenteSeleccionado}
          recursos={recursos.datos}
          zonas={zonas.datos}
          ahora={ahora}
          onCambiarEstadoIncidente={acciones.cambiarEstadoIncidente}
          onCambiarEstadoRecurso={acciones.cambiarEstadoRecurso}
          onCambiarOcupacion={acciones.cambiarOcupacion}
        />
      }
      tablero={
        <TableroUnidades
          recursos={recursos.datos}
          incidenteSeleccionadoId={seleccionadoId}
          onSeleccionarUnidad={(unidad) => {
            if (unidad.incidente_asignado_id) setSeleccionadoId(unidad.incidente_asignado_id);
          }}
        />
      }
    />
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
  return <Mesa servicio={servicio} operador={sesion.email} onCerrarSesion={cerrarSesion} />;
}
