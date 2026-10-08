import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@argos/ui';
import { Login } from './components/Login';
import { MapaTactico } from './layout/MapaTactico';
import { useAccionesOperador } from './hooks/useAccionesOperador';
import {
  useIncidentesRealtime,
  useLlamadasRealtime,
  useRecursosRealtime,
  useZonasPublicasRealtime,
} from './hooks/useListaRealtime';
import { useAccionesLlamada } from './hooks/useAccionesLlamada';
import { useAtajos } from './hooks/useAtajos';
import { usePanelColapsable } from './hooks/usePanelColapsable';
import { useReloj } from './hooks/useReloj';
import { useSimulacion } from './hooks/useSimulacion';
import type { CandidatoDuplicado, Coordenadas, Llamada, NuevaLlamada } from '@argos/shared';
import { dividirCola, moverSeleccion } from './domain/cola';
import { estadoEnlace } from './domain/conexion';
import { entrantes, reporteDeLlamada } from './domain/entrantes';
import { BORRADOR_VACIO, borradorDesdeLlamada, type Borrador } from './domain/llamadas';
import { crearRelojSimulado, type RelojSimulado } from './domain/relojSimulado';
import { MODOS_TRAZADO, type ModoTrazado } from './domain/trazado';
import { BarraEstado } from './layout/BarraEstado';
import { ColaIncidentes } from './layout/ColaIncidentes';
import { FormularioLlamada } from './layout/FormularioLlamada';
import { GrillaTactica } from './layout/GrillaTactica';
import { PanelDetalle } from './layout/PanelDetalle';
import { TableroUnidades } from './layout/TableroUnidades';
import { useTexto } from './i18n/IdiomaProvider';
import { crearServicioDesdeEntorno, type ServicioMesa, type SesionOperador } from './services/supabaseClient';
import { crearServicioDemo } from './services/servicioDemo';
import { aplicarTema, temaGuardado, type Tema } from './tema';

/** Formulario de llamada abierto: vacío (F2) o precargado desde una entrante. `clave` lo remonta al cambiar de llamada. */
interface FormularioAbierto {
  readonly clave: number;
  readonly inicial: Borrador;
  readonly llamadaId: string | null;
}

/** Servicio demo con su reloj simulado: la consola y los datos comparten la misma hora acelerable. */
function crearEntornoDemo(): { readonly servicio: ServicioMesa; readonly reloj: RelojSimulado } {
  const reloj = crearRelojSimulado();
  return { servicio: crearServicioDemo({ ahora: reloj.ahora }), reloj };
}

function Mesa({
  servicio,
  reloj,
  operador,
  onReiniciarSimulacion,
  onCerrarSesion,
}: {
  readonly servicio: ServicioMesa;
  /** Solo en modo demo. */
  readonly reloj?: RelojSimulado;
  readonly operador: string;
  readonly onReiniciarSimulacion?: () => void;
  readonly onCerrarSesion: () => void;
}) {
  const { t } = useTexto();
  const incidentes = useIncidentesRealtime(servicio);
  const llamadas = useLlamadasRealtime(servicio);
  const recursos = useRecursosRealtime(servicio);
  const zonas = useZonasPublicasRealtime(servicio);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [formulario, setFormulario] = useState<FormularioAbierto | null>(null);
  const [ubicacionLlamada, setUbicacionLlamada] = useState<Coordenadas | null>(null);
  const [resaltadoId, setResaltadoId] = useState<string | null>(null);
  const llamadaAbiertaId = formulario?.llamadaId ?? null;
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
  const ahora = useReloj(desfaseMs, 1000, reloj?.ahora);
  const simulacion = useSimulacion(servicio, reloj);

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
    operador,
  });

  const { guardarTrazado } = acciones;
  const alFigura = useCallback(
    (f: Parameters<typeof guardarTrazado>[0]) => {
      setDibujando(false);
      guardarTrazado(f);
    },
    [guardarTrazado],
  );
  const accionesLlamada = useAccionesLlamada({
    servicio,
    incidentes: incidentes.datos,
    alSeleccionar: setSeleccionadoId,
    alAvisar: setAviso,
    operador,
    ahora: reloj?.ahora,
  });
  const abrirFormulario = useCallback(
    (inicial: Borrador, llamadaId: string | null, ubicacion: Coordenadas | null) => {
      setFormulario((actual) => ({ clave: (actual?.clave ?? 0) + 1, inicial, llamadaId }));
      setUbicacionLlamada(ubicacion);
      expandirDetalle();
    },
    [expandirDetalle],
  );
  const cerrarFormulario = useCallback(() => {
    setFormulario(null);
    setUbicacionLlamada(null);
    setResaltadoId(null);
  }, []);
  const abrirLlamadaManual = useCallback(() => abrirFormulario(BORRADOR_VACIO, null, null), [abrirFormulario]);
  // Objeto nuevo en cada clic: el mapa vuelve a centrar aunque se repita la misma llamada.
  const alAbrirLlamada = useCallback(
    (l: Llamada) => {
      abrirFormulario(borradorDesdeLlamada(l), l.id, l.ubicacion);
      setFoco({ lat: l.ubicacion.lat, lng: l.ubicacion.lng });
    },
    [abrirFormulario],
  );
  const { descartarReporte } = acciones;
  const alDescartarLlamada = useCallback(
    (l: Llamada) => {
      setFormulario((actual) => (actual?.llamadaId === l.id ? null : actual));
      descartarReporte(reporteDeLlamada(l));
    },
    [descartarReporte],
  );
  const alCrearIncidenteDesdeLlamada = useCallback(
    (datos: NuevaLlamada, descartados: readonly CandidatoDuplicado[]) =>
      accionesLlamada.crearIncidente(datos, formulario?.llamadaId ?? null, descartados),
    [accionesLlamada, formulario?.llamadaId],
  );
  const alVincularLlamada = useCallback(
    (datos: NuevaLlamada, candidato: CandidatoDuplicado) =>
      accionesLlamada.vincular(datos, formulario?.llamadaId ?? null, candidato.incidenteId),
    [accionesLlamada, formulario?.llamadaId],
  );
  const reportes = useMemo(() => llamadas.datos.map(reporteDeLlamada), [llamadas.datos]);
  const totalEntrantes = useMemo(() => entrantes(llamadas.datos).length, [llamadas.datos]);
  const incidenteSeleccionado = incidentes.datos.find((i) => i.id === seleccionadoId) ?? null;
  const alErrorDibujo = useCallback((mensaje: string) => setAviso(mensaje), []);

  const ordenCola = useMemo(() => dividirCola(incidentes.datos).activos.map((i) => i.id), [incidentes.datos]);
  useAtajos({
    j: () => setSeleccionadoId((actual) => moverSeleccion(ordenCola, actual, 1)),
    k: () => setSeleccionadoId((actual) => moverSeleccion(ordenCola, actual, -1)),
    F2: () => {
      if (!formulario) abrirLlamadaManual();
    },
    Escape: () => setDibujando(false),
  });

  const enlace = estadoEnlace([incidentes, llamadas, recursos, zonas]);
  const mensaje = aviso ?? incidentes.error ?? recursos.error ?? zonas.error ?? llamadas.error;

  const mapa = (
    <>
      <MapaTactico
        incidentes={incidentes.datos}
        zonas={zonas.datos}
        reportes={reportes}
        seleccionadoId={seleccionadoId}
        reporteSeleccionadoId={llamadaAbiertaId}
        onSeleccionar={setSeleccionadoId}
        foco={foco}
        dibujando={dibujando}
        modoTrazado={modoTrazado}
        onFigura={alFigura}
        onErrorDibujo={alErrorDibujo}
        ubicacionLlamada={formulario ? ubicacionLlamada : null}
        onClicUbicacion={formulario ? setUbicacionLlamada : undefined}
        resaltadoIncidenteId={resaltadoId}
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
          {dibujando ? t('trazado.cancelar') : t('trazado.iniciar')}
        </Button>
        {dibujando && (
          <div className="border border-border-strong bg-surface-panel p-3 shadow-overlay">
            <p className="font-mono text-overline uppercase text-text-primary">{t('trazado.titulo')}</p>
            <div role="group" aria-label={t('trazado.figura')} className="mt-2 flex gap-1">
              {MODOS_TRAZADO.map((m) => (
                <Button key={m} size="sm" variant={m === modoTrazado ? 'secondary' : 'ghost'} aria-pressed={m === modoTrazado} onClick={() => setModoTrazado(m)}>
                  {m === 'poligono' ? t('trazado.poligono') : t('trazado.linea')}
                </Button>
              ))}
            </div>
            <p className="mt-2 max-w-64 font-ui text-body-sm text-text-secondary">
              {modoTrazado === 'poligono' && incidenteSeleccionado
                ? t('trazado.destino.riesgo', { titulo: incidenteSeleccionado.titulo })
                : t('trazado.destino.publica')}{' '}
              {t('trazado.ayuda')}
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
          entrantes={totalEntrantes}
          simulacion={
            simulacion && onReiniciarSimulacion
              ? {
                  reproduciendo: simulacion.reproduciendo,
                  velocidad: simulacion.velocidad,
                  tSeg: simulacion.tSeg,
                  duracionSeg: simulacion.duracionSeg,
                  onAlternar: simulacion.alternar,
                  onVelocidad: simulacion.fijarVelocidad,
                  onReiniciar: onReiniciarSimulacion,
                }
              : undefined
          }
          onCerrarSesion={onCerrarSesion}
        />
      }
      cola={
        <ColaIncidentes
          incidentes={incidentes.datos}
          recursos={recursos.datos}
          llamadas={llamadas.datos}
          ahora={ahora}
          seleccionadoId={seleccionadoId}
          onSeleccionar={setSeleccionadoId}
          llamadaAbiertaId={llamadaAbiertaId}
          onAbrirLlamada={alAbrirLlamada}
          onDescartarLlamada={alDescartarLlamada}
        />
      }
      mapa={mapa}
      detalle={
        <div className="relative min-h-0 flex-1">
          <PanelDetalle
            incidente={incidenteSeleccionado}
            recursos={recursos.datos}
            zonas={zonas.datos}
            ahora={ahora}
            onCambiarEstadoIncidente={acciones.cambiarEstadoIncidente}
            onCambiarEstadoRecurso={acciones.cambiarEstadoRecurso}
            onCambiarOcupacion={acciones.cambiarOcupacion}
          />
          {formulario && (
            <div className="absolute inset-0 z-panel">
              <FormularioLlamada
                key={formulario.clave}
                inicial={formulario.inicial}
                entrante={formulario.llamadaId !== null}
                ubicacion={ubicacionLlamada}
                onUbicacionCambia={setUbicacionLlamada}
                incidentes={incidentes.datos}
                ahora={ahora}
                onCerrar={cerrarFormulario}
                onCrearIncidente={alCrearIncidenteDesdeLlamada}
                onVincular={alVincularLlamada}
                onResaltarIncidente={setResaltadoId}
              />
            </div>
          )}
        </div>
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
  const { t } = useTexto();
  const real = useMemo(() => crearServicioDesdeEntorno(), []);
  const [demo, setDemo] = useState(() => (real ? null : crearEntornoDemo()));
  const servicio = real ?? demo?.servicio;
  const [corrida, setCorrida] = useState(0);
  // Reiniciar descarta el servicio y el reloj del demo y monta la consola de nuevo, con los datos de partida.
  const reiniciarSimulacion = useCallback(() => {
    setDemo(crearEntornoDemo());
    setCorrida((n) => n + 1);
  }, []);
  const [sesion, setSesion] = useState<SesionOperador | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!servicio) return;
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
      if (!servicio) return;
      setError(null);
      try {
        const s = await servicio.iniciarSesion(email, password);
        if (!s.esOperador) {
          await servicio.cerrarSesion();
          setError(t('login.error.rol'));
          return;
        }
        setSesion(s);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('login.error.desconocido'));
      }
    },
    [servicio, t],
  );

  const cerrarSesion = useCallback(() => {
    void servicio?.cerrarSesion().finally(() => setSesion(null));
  }, [servicio]);

  if (!servicio || sesion === undefined) return null;
  if (!sesion?.esOperador) return <Login onIniciarSesion={iniciarSesion} error={error} />;
  return (
    <Mesa
      key={corrida}
      servicio={servicio}
      reloj={demo?.reloj}
      operador={sesion.email}
      onReiniciarSimulacion={demo ? reiniciarSimulacion : undefined}
      onCerrarSesion={cerrarSesion}
    />
  );
}
