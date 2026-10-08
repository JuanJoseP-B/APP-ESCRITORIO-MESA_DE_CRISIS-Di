import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@argos/ui';
import { Login } from './components/Login';
import { MapaTactico } from './layout/MapaTactico';
import { PanelAjustes } from './layout/PanelAjustes';
import { useAccionesOperador } from './hooks/useAccionesOperador';
import {
  useEventosRecursoRealtime,
  useIncidentesRealtime,
  useLlamadasRealtime,
  useRecursosRealtime,
  useZonasPublicasRealtime,
} from './hooks/useListaRealtime';
import { useAccionesLlamada } from './hooks/useAccionesLlamada';
import { useAsesor } from './hooks/useAsesor';
import { useAtajos } from './hooks/useAtajos';
import { usePreferencias } from './hooks/usePreferencias';
import { usePanelColapsable } from './hooks/usePanelColapsable';
import { useReloj } from './hooks/useReloj';
import { useAvisosSla } from './hooks/useAvisosSla';
import { useSla } from './hooks/useSla';
import { useSimulacion } from './hooks/useSimulacion';
import type { CandidatoDuplicado, Coordenadas, Llamada, NuevaLlamada } from '@argos/shared';
import { dividirCola, filtrarPorIds, moverSeleccion } from './domain/cola';
import { estadoEnlace } from './domain/conexion';
import { entrantes, reporteDeLlamada } from './domain/entrantes';
import { BORRADOR_VACIO, borradorDesdeLlamada, type Borrador } from './domain/llamadas';
import { construirSnapshot, previsualizarRecomendacion } from './domain/asesor';
import { crearMotorReglas } from './domain/motorReglas';
import { unidadesParaMapa } from './domain/unidadesMapa';
import { indicativosDe } from './domain/unidades';
import { PASOS_SIN_ANIMACION, movimientosEnRuta, posicionesDe, type MovimientoUnidad } from './domain/movimiento';
import { rutasAFeatureCollection } from './domain/geojson';
import { analizarPerimetro, type ObjetivoResaltado } from './domain/analisisEspacial';
import { perimetroDeIncidente } from './domain/perimetro';
import { useLlegadaUnidades } from './hooks/useLlegadaUnidades';
import { crearRelojSimulado, type RelojSimulado } from './domain/relojSimulado';
import { MODOS_TRAZADO, type ModoTrazado } from './domain/trazado';
import { AvisosSla } from './layout/AvisosSla';
import { ConfirmacionPlan } from './layout/ConfirmacionPlan';
import { DialogoDespacho } from './layout/DialogoDespacho';
import { BarraEstado } from './layout/BarraEstado';
import { ColaIncidentes } from './layout/ColaIncidentes';
import { FormularioLlamada } from './layout/FormularioLlamada';
import { GrillaTactica } from './layout/GrillaTactica';
import { HojaAtajos } from './layout/HojaAtajos';
import { PanelDetalle } from './layout/PanelDetalle';
import { TableroUnidades } from './layout/TableroUnidades';
import { InvitacionTutorial } from './layout/InvitacionTutorial';
import { TutorialProvider } from './layout/TutorialProvider';
import { useTexto } from './i18n/IdiomaProvider';
import { crearServicioDesdeEntorno, type ServicioMesa, type SesionOperador } from './services/supabaseClient';
import { crearServicioDemo } from './services/servicioDemo';

const SIN_MOVIMIENTOS: readonly MovimientoUnidad[] = [];

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
  const eventosRecurso = useEventosRecursoRealtime(servicio);
  const zonas = useZonasPublicasRealtime(servicio);
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null);
  const [unidadId, setUnidadId] = useState<string | null>(null);
  const [resaltado, setResaltado] = useState<ObjetivoResaltado | null>(null);
  const [formulario, setFormulario] = useState<FormularioAbierto | null>(null);
  const [ubicacionLlamada, setUbicacionLlamada] = useState<Coordenadas | null>(null);
  const [resaltadoId, setResaltadoId] = useState<string | null>(null);
  const llamadaAbiertaId = formulario?.llamadaId ?? null;
  const [foco, setFoco] = useState<Coordenadas | null>(null);
  const [dibujando, setDibujando] = useState(false);
  const [modoTrazado, setModoTrazado] = useState<ModoTrazado>('poligono');
  const [aviso, setAviso] = useState<string | null>(null);
  const { temaEfectivo, preferencias } = usePreferencias();
  const { reducirMovimiento } = preferencias;
  const [ajustesAbiertos, setAjustesAbiertos] = useState(false);
  const [despachoAbierto, setDespachoAbierto] = useState(false);
  const [planAbierto, setPlanAbierto] = useState(false);
  const [atajosAbiertos, setAtajosAbiertos] = useState(false);
  const abrirAjustes = useCallback(() => setAjustesAbiertos(true), []);
  const cerrarAjustes = useCallback(() => setAjustesAbiertos(false), []);
  const abrirAtajos = useCallback(() => setAtajosAbiertos(true), []);
  const cerrarAtajos = useCallback(() => setAtajosAbiertos(false), []);
  // Desde Ajustes → Ayuda: los ajustes se cierran y la hoja ocupa su lugar.
  const abrirAtajosDesdeAjustes = useCallback(() => {
    setAjustesAbiertos(false);
    setAtajosAbiertos(true);
  }, []);

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
  // En el demo la hora corre acelerada y las unidades se desplazan: se refresca varias veces por segundo.
  const ahora = useReloj(desfaseMs, reloj ? 250 : 1000, reloj?.ahora);
  const simulacion = useSimulacion(servicio, reloj);
  // Cronómetros SLA de las unidades despachadas: se recalculan a 1 Hz sobre la hora de la consola.
  const sla = useSla(recursos.datos, eventosRecurso.datos, incidentes.datos, desfaseMs, reloj?.ahora);
  const slaEnRiesgo = sla.resumen.alertas + sla.resumen.vencidos;
  // El filtro de la cola por SLA se retira solo cuando ya no queda ninguna unidad en riesgo.
  const [filtroSla, setFiltroSla] = useState(false);
  useEffect(() => {
    if (slaEnRiesgo === 0) setFiltroSla(false);
  }, [slaEnRiesgo]);
  const idsFiltroSla = filtroSla ? sla.resumen.incidentesEnRiesgo : null;
  const quitarFiltroSla = useCallback(() => setFiltroSla(false), []);
  const alternarFiltroSla = useCallback(() => setFiltroSla((activo) => !activo), []);
  const avisosSla = useAvisosSla(sla.resumen.unidadesVencidas);
  const indicativos = useMemo(() => indicativosDe(recursos.datos), [recursos.datos]);

  const panelCola = usePanelColapsable('cola');
  const panelDetalle = usePanelColapsable('detalle');
  const { expandir: expandirDetalle } = panelDetalle;
  const { expandir: expandirCola } = panelCola;
  // Elegir un incidente abre el detalle: ahí vive el despacho.
  useEffect(() => {
    if (seleccionadoId) expandirDetalle();
  }, [seleccionadoId, expandirDetalle]);
  // El despacho es del incidente que lo abrió: si el operador cambia de incidente, se cierra.
  useEffect(() => setDespachoAbierto(false), [seleccionadoId]);

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
  // El recorrido guiado deja la consola lista para cada paso: con el primer incidente activo a la vista si hace falta.
  const primerIncidenteId = useMemo(() => dividirCola(incidentes.datos).activos[0]?.id ?? null, [incidentes.datos]);
  const seleccionarPrimero = useCallback(() => setSeleccionadoId((actual) => actual ?? primerIncidenteId), [primerIncidenteId]);
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
  useLlegadaUnidades({ servicio, reloj, recursos: recursos.datos, eventos: eventosRecurso.datos, incidentes: incidentes.datos });
  // Las unidades EN_RUTA se interpolan según el reloj; con «reducir movimiento» saltan por tramos en vez de deslizarse.
  const movimientos = useMemo(() => {
    const m = reloj
      ? movimientosEnRuta(recursos.datos, eventosRecurso.datos, incidentes.datos, ahora, reducirMovimiento ? PASOS_SIN_ANIMACION : undefined)
      : SIN_MOVIMIENTOS;
    // Sin unidades en ruta se devuelve siempre el mismo arreglo: el mapa no se repinta cada cuarto de segundo.
    return m.length === 0 ? SIN_MOVIMIENTOS : m;
  }, [reloj, recursos.datos, eventosRecurso.datos, incidentes.datos, ahora, reducirMovimiento]);
  const unidadesMapa = useMemo(() => unidadesParaMapa(recursos.datos, posicionesDe(movimientos)), [recursos.datos, movimientos]);
  // Los anillos se generan al crear o seleccionar un incidente; solo cambian si cambia su tipo, su lugar o su perímetro.
  const { tipo: tipoSel, geometria: geometriaSel, perimetro: perimetroSel } = incidenteSeleccionado ?? {};
  const anillos = useMemo(
    () => (tipoSel !== undefined && geometriaSel ? perimetroDeIncidente({ tipo: tipoSel, geometria: geometriaSel, perimetro: perimetroSel }).anillos : []),
    [tipoSel, geometriaSel, perimetroSel],
  );
  // Refugios por anillo, unidades en zona caliente y bloqueos afectados; se recalcula cuando una unidad se mueve.
  const perimetro = useMemo(
    () => (anillos.length > 0 ? { anillos, analisis: analizarPerimetro(anillos, zonas.datos, unidadesMapa, seleccionadoId) } : null),
    [anillos, zonas.datos, unidadesMapa, seleccionadoId],
  );
  // Copiloto táctico: motor de reglas local. Solo recomienda; nada cambia hasta que el operador confirma.
  const motorAsesor = useMemo(() => crearMotorReglas({ t }), [t]);
  const incidenteAsesorId = incidenteSeleccionado && incidenteSeleccionado.estado !== 'Resuelto' ? incidenteSeleccionado.id : null;
  const construirAsesor = useCallback(
    () =>
      incidenteSeleccionado
        ? construirSnapshot({ incidente: incidenteSeleccionado, llamadas: llamadas.datos, unidades: unidadesMapa, zonas: zonas.datos, sla: sla.porRecurso, ahoraMs: ahora })
        : null,
    [incidenteSeleccionado, llamadas.datos, unidadesMapa, zonas.datos, sla.porRecurso, ahora],
  );
  const asesor = useAsesor({ motor: motorAsesor, incidenteId: incidenteAsesorId, construir: construirAsesor });
  const estadoAsesor = asesor.estado;
  const previsualizacion = useMemo(
    () => (estadoAsesor.fase === 'listo' ? previsualizarRecomendacion(estadoAsesor.snapshot, estadoAsesor.recomendacion) : null),
    [estadoAsesor],
  );
  // La confirmación pertenece a la recomendación que la abrió: si la tarjeta se cierra o se rehace, también se cierra.
  const faseAsesor = estadoAsesor.fase;
  useEffect(() => {
    if (faseAsesor !== 'listo') setPlanAbierto(false);
  }, [faseAsesor]);
  const unidadesEnAlerta = useMemo(() => new Set(perimetro?.analisis.unidadesEnZonaCaliente ?? []), [perimetro]);
  const rutasMapa = useMemo(() => rutasAFeatureCollection(movimientos), [movimientos]);
  // Elegir la misma unidad otra vez la suelta. Una unidad asignada lleva también al incidente al que va.
  const alSeleccionarUnidad = useCallback(
    (id: string) => {
      setUnidadId((actual) => (actual === id ? null : id));
      const asignado = recursos.datos.find((r) => r.id === id)?.incidente_asignado_id;
      if (asignado) setSeleccionadoId(asignado);
    },
    [recursos.datos],
  );

  const ordenCola = useMemo(() => filtrarPorIds(dividirCola(incidentes.datos).activos, idsFiltroSla).map((i) => i.id), [incidentes.datos, idsFiltroSla]);
  useAtajos({
    j: () => setSeleccionadoId((actual) => moverSeleccion(ordenCola, actual, 1)),
    k: () => setSeleccionadoId((actual) => moverSeleccion(ordenCola, actual, -1)),
    F1: abrirAtajos,
    '?': abrirAtajos,
    F2: () => {
      if (!formulario && !despachoAbierto) abrirLlamadaManual();
    },
    d: () => {
      if (!incidenteSeleccionado || incidenteSeleccionado.estado === 'Resuelto' || formulario || planAbierto) return;
      expandirDetalle();
      setDespachoAbierto(true);
    },
    a: () => {
      if (!incidenteAsesorId || formulario || despachoAbierto || planAbierto) return;
      expandirDetalle();
      asesor.alternar();
    },
    Escape: () => {
      if (despachoAbierto || planAbierto) return; // el propio diálogo (despacho o confirmación del asesor) se cierra con Esc
      if (estadoAsesor.fase !== 'inactivo' && !dibujando) {
        asesor.cerrar();
        return;
      }
      setDibujando(false);
      setUnidadId(null);
    },
  }, !ajustesAbiertos && !atajosAbiertos);

  // Lo que el operador está viendo en la tarjeta del asesor; con ello se aplica o se descarta.
  const sugerencia =
    estadoAsesor.fase === 'listo' && incidenteSeleccionado
      ? { incidente: incidenteSeleccionado, snapshot: estadoAsesor.snapshot, recomendacion: estadoAsesor.recomendacion }
      : null;
  const abrirPlan = useCallback(() => setPlanAbierto(true), []);
  const descartarSugerencia = () => {
    if (!sugerencia) return;
    acciones.descartarSugerenciaAsesor(sugerencia);
    asesor.cerrar();
  };
  const confirmarPlan = (marcadas: ReadonlySet<string>) => {
    if (!sugerencia) return;
    acciones.aplicarSugerenciaAsesor({ ...sugerencia, marcadas, recursos: recursos.datos });
    setPlanAbierto(false);
    asesor.cerrar();
  };

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
        unidades={unidadesMapa}
        rutas={rutasMapa}
        anillos={anillos}
        unidadesEnAlerta={unidadesEnAlerta}
        resaltado={resaltado}
        sla={sla.porRecurso}
        reducirMovimiento={reducirMovimiento}
        unidadSeleccionadaId={unidadId}
        onSeleccionarUnidad={alSeleccionarUnidad}
        previsualizacion={previsualizacion}
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
      <InvitacionTutorial />
      <AvisosSla avisos={avisosSla.avisos} indicativos={indicativos} onDescartar={avisosSla.descartar} />
      {mensaje && (
        <p role="status" className="absolute bottom-4 left-4 z-toolbar border border-border-strong bg-surface-panel px-3 py-2 font-mono text-data-sm text-text-primary shadow-overlay">
          <span aria-hidden="true" className="mr-2 text-status-info">◆</span>
          {mensaje}
        </p>
      )}
    </>
  );

  return (
    <TutorialProvider preparacion={{ expandirCola, expandirDetalle, seleccionarPrimero, cerrarFormulario }} simulacion={simulacion} reducirMovimiento={reducirMovimiento}>
      <GrillaTactica
        panelCola={panelCola}
        panelDetalle={panelDetalle}
        barra={
          <BarraEstado
            hora={ahora}
            turno={temaEfectivo}
            operador={operador}
            enlace={enlace}
            entrantes={totalEntrantes}
            slaEnRiesgo={slaEnRiesgo}
            slaNivel={sla.resumen.nivel === 'VENCIDO' ? 'VENCIDO' : 'ALERTA'}
            filtroSlaActivo={filtroSla}
            onFiltrarSla={alternarFiltroSla}
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
            onAbrirAjustes={abrirAjustes}
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
            filtroSla={idsFiltroSla ? { incidentes: idsFiltroSla, onQuitar: quitarFiltroSla } : null}
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
              perimetro={perimetro}
              onResaltar={setResaltado}
              onAbrirDespacho={() => setDespachoAbierto(true)}
              asesor={{
                estado: estadoAsesor,
                onAlternar: asesor.alternar,
                onAplicar: abrirPlan,
                onDescartar: descartarSugerencia,
                onCerrar: asesor.cerrar,
              }}
              sla={sla.porRecurso}
              reducirMovimiento={reducirMovimiento}
            />
            {despachoAbierto && incidenteSeleccionado && !formulario && (
              <div className="absolute inset-0 z-panel">
                <DialogoDespacho
                  incidente={incidenteSeleccionado}
                  recursos={recursos.datos}
                  onConfirmar={(recurso) => {
                    acciones.cambiarEstadoRecurso(recurso, 'ASIGNADO', incidenteSeleccionado.id);
                    setDespachoAbierto(false);
                  }}
                  onCancelar={() => setDespachoAbierto(false)}
                />
              </div>
            )}
            {planAbierto && sugerencia && !formulario && (
              <div className="absolute inset-0 z-panel">
                <ConfirmacionPlan
                  key={sugerencia.recomendacion.idRecomendacion}
                  snapshot={sugerencia.snapshot}
                  recomendacion={sugerencia.recomendacion}
                  onConfirmar={confirmarPlan}
                  onCancelar={() => setPlanAbierto(false)}
                />
              </div>
            )}
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
            unidadSeleccionadaId={unidadId}
            onSeleccionarUnidad={(unidad) => alSeleccionarUnidad(unidad.id)}
            sla={sla.porRecurso}
            reducirMovimiento={reducirMovimiento}
          />
        }
      />
      {ajustesAbiertos && <PanelAjustes onCerrar={cerrarAjustes} onAbrirAtajos={abrirAtajosDesdeAjustes} />}
      {atajosAbiertos && <HojaAtajos onCerrar={cerrarAtajos} />}
    </TutorialProvider>
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
