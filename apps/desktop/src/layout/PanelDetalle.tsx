import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ESTADOS_INCIDENTE,
  TRANSICIONES_RECURSO,
  type AnalisisPerimetro,
  type EstadoIncidente,
  type EstadoSla,
  type EstadoRecurso,
  type Incidente,
  type Recurso,
  type ZonaPublica,
} from '@argos/shared';
import { Badge, Button, DispatchRow, Kbd, SectionHeader, curva, duracion, duracionSegundos, type VarianteBoton } from '@argos/ui';
import type { ObjetivoResaltado } from '../domain/analisisEspacial';
import { codigoIncidente, estaCerrado, minutosAbierto } from '../domain/cola';
import type { AnilloGenerado } from '../domain/perimetro';
import { bitacora, type EntradaBitacora } from '../domain/timeline';
import {
  textoAccionRecurso,
  textoEstadoIncidente,
  textoEstadoRecurso,
  textoSeveridad,
  textoTipoRecurso,
} from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { indicativosDe } from '../domain/unidades';
import type { EstadoAsesor } from '../hooks/useAsesor';
import { PanelRefugios } from '../components/PanelRefugios';
import { formatearDuracion } from './ColaIncidentes';
import { CronometroUnidad } from './CronometroUnidad';
import { SeccionPerimetro } from './SeccionPerimetro';
import { TarjetaAsesor } from './TarjetaAsesor';
import { ESTADO_INCIDENTE_UI, ESTADO_RECURSO_UI, SEVERIDAD_UI } from './presentacion';

/** Asesor táctico del incidente mostrado: su estado y lo que el operador puede hacer con la tarjeta. */
export interface AsesorDetalle {
  readonly estado: EstadoAsesor;
  /** Botón [ASESOR] y atajo A: abre la tarjeta o la cierra. */
  readonly onAlternar: () => void;
  /** [APLICAR SUGERENCIA]: abre la confirmación por acción. */
  readonly onAplicar: () => void;
  /** [DESCARTAR]: rechaza la sugerencia y lo registra. */
  readonly onDescartar: () => void;
  readonly onCerrar: () => void;
}

export interface PanelDetalleProps {
  /** Incidente seleccionado; sin él no hay ficha ni se puede despachar. */
  incidente: Incidente | null;
  recursos: readonly Recurso[];
  zonas: readonly ZonaPublica[];
  /** Hora corregida (ms epoch) para el tiempo abierto. */
  ahora: number;
  onCambiarEstadoIncidente: (incidente: Incidente, estado: EstadoIncidente) => void;
  /** Mutación de la unidad; al despachar recibe el `incidenteId` del incidente mostrado. */
  onCambiarEstadoRecurso: (recurso: Recurso, estado: EstadoRecurso, incidenteId: string) => void;
  onCambiarOcupacion: (zona: ZonaPublica, delta: number) => void;
  /** Anillos del incidente y su análisis espacial; sin ellos no se muestra la sección del perímetro. */
  perimetro?: { readonly anillos: readonly AnilloGenerado[]; readonly analisis: AnalisisPerimetro } | null;
  /** Al señalar un ítem del análisis (cursor o foco) el mapa lo resalta; `null` al soltarlo. */
  onResaltar?: (objetivo: ObjetivoResaltado | null) => void;
  /** Abre el despacho con el teclado (atajo D): unidad libre más cercana preseleccionada. */
  onAbrirDespacho?: () => void;
  /** Copiloto táctico; sin él no hay botón [ASESOR] ni tarjeta. */
  asesor?: AsesorDetalle;
  /** SLA de las unidades con despacho en curso, por id de recurso; las asignadas llevan su cronómetro. */
  sla?: ReadonlyMap<string, EstadoSla>;
  /** Menos movimiento: el cronómetro vencido no parpadea y se marca con rayas. */
  reducirMovimiento?: boolean;
}

const SIN_SLA: ReadonlyMap<string, EstadoSla> = new Map();

/** Solo Despachar es la acción primaria (naranja); el resto es secundaria o neutra. */
const VARIANTE_ACCION: Record<EstadoRecurso, VarianteBoton> = {
  DISPONIBLE: 'ghost',
  ASIGNADO: 'primary',
  EN_RUTA: 'secondary',
  EN_ESCENA: 'secondary',
  INOPERATIVO: 'ghost',
};

/** Cada sección del detalle entra con un fundido y un paso corto hacia arriba; el contenedor las escalona. */
const SECCION = { entra: { opacity: 0, y: 8 }, visible: { opacity: 1, y: 0 } };

const SIN_NUEVAS: ReadonlySet<string> = new Set();

/** Clave estable de cada línea: no depende de su posición, así una línea que llega no cambia las demás. */
function clavesBitacora(entradas: readonly EntradaBitacora[]): readonly string[] {
  const repetidas = new Map<string, number>();
  return entradas.map((e) => {
    const base = e.tipo === 'fecha' ? `fecha-${e.clave}` : `${e.iso ?? e.hora}|${e.descripcion}|${e.autor ?? ''}`;
    const n = repetidas.get(base) ?? 0;
    repetidas.set(base, n + 1);
    return n === 0 ? base : `${base}#${n}`;
  });
}

/** Línea de tiempo del incidente. Las líneas que llegan con el panel abierto entran deslizándose, con un resaltado breve. */
function Bitacora({ entradas, sinAutor }: { readonly entradas: readonly EntradaBitacora[]; readonly sinAutor: string }) {
  const claves = clavesBitacora(entradas);
  const firma = claves.join('\n');
  const vistas = useRef<ReadonlySet<string> | null>(null);
  const [nuevas, setNuevas] = useState(SIN_NUEVAS);
  useEffect(() => {
    const previas = vistas.current;
    const actuales = firma === '' ? [] : firma.split('\n');
    vistas.current = new Set(actuales);
    // La primera lectura es la base: lo que ya estaba al abrir el incidente no se anima.
    if (!previas) return;
    const llegadas = actuales.filter((clave) => !previas.has(clave));
    const ms = duracion('slow');
    if (llegadas.length === 0 || ms <= 0) return;
    setNuevas(new Set(llegadas));
    const temporizador = setTimeout(() => setNuevas(SIN_NUEVAS), ms);
    return () => clearTimeout(temporizador);
  }, [firma]);

  return (
    <ol className="px-4 pb-3 font-mono text-data-sm text-text-secondary">
      {entradas.map((e, n) => {
        const clave = claves[n];
        return e.tipo === 'fecha' ? (
          <li key={clave} className="mt-2 border-t border-border-subtle pt-2 text-overline uppercase text-text-muted first:mt-0 first:border-t-0 first:pt-0">
            <time dateTime={e.clave}>{e.etiqueta}</time>
          </li>
        ) : (
          <li key={clave} data-nueva={(clave !== undefined && nuevas.has(clave)) || undefined} className="ag-bitacora-linea py-0.5">
            <time dateTime={e.iso ?? undefined} className="mr-2 font-bold tabular text-text-primary">
              {e.hora}
            </time>
            {e.descripcion}
            <span className="text-text-muted"> · {e.autor ?? sinAutor}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** D · detalle del incidente: ficha, unidades (aquí vive DESPACHAR), línea de tiempo y refugios. */
export function PanelDetalle({
  incidente,
  recursos,
  zonas,
  ahora,
  onCambiarEstadoIncidente,
  onCambiarEstadoRecurso,
  onCambiarOcupacion,
  perimetro = null,
  onResaltar = () => undefined,
  onAbrirDespacho,
  asesor,
  sla = SIN_SLA,
  reducirMovimiento = false,
}: PanelDetalleProps) {
  const { t, idioma } = useTexto();
  const refugios = <PanelRefugios zonas={zonas} onCambiarOcupacion={onCambiarOcupacion} />;

  if (incidente === null) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <p className="px-4 py-4 font-mono text-data-sm text-text-muted">
          {t('detalle.vacio')}
        </p>
        {refugios}
      </div>
    );
  }

  // Indicativo completo ("B-02", "M11"): el id de base de datos no sirve para dictar por radio.
  const indicativos = indicativosDe(recursos);
  const nombreUnidad = (r: Recurso): string => indicativos.get(r.id) ?? r.id;

  const accionesDe = (r: Recurso) =>
    TRANSICIONES_RECURSO[r.estado_actual].map((destino) => (
      <Button
        key={destino}
        size="sm"
        variant={VARIANTE_ACCION[destino]}
        aria-label={t('detalle.accion.aria', { accion: textoAccionRecurso(t, destino), unidad: nombreUnidad(r) })}
        onClick={() => onCambiarEstadoRecurso(r, destino, incidente.id)}
      >
        {destino === 'ASIGNADO' ? t('detalle.despachar') : textoAccionRecurso(t, destino)}
      </Button>
    ));

  const filaDe = (r: Recurso) => (
    <DispatchRow
      kind={textoTipoRecurso(t, r.tipo)}
      code={nombreUnidad(r)}
      status={ESTADO_RECURSO_UI[r.estado_actual]}
      statusLabel={textoEstadoRecurso(t, r.estado_actual)}
      timer={<CronometroUnidad sla={sla.get(r.id)} reducirMovimiento={reducirMovimiento} />}
      actions={accionesDe(r)}
    />
  );
  const fila = (r: Recurso) => <li key={r.id}>{filaDe(r)}</li>;
  const base = { duration: duracionSegundos('base'), ease: curva('salida') };

  // Un incidente resuelto ya no admite despachos: solo se pueden liberar las unidades que aún tenga.
  const cerrado = estaCerrado(incidente);
  const asignadas = recursos.filter((r) => r.incidente_asignado_id === incidente.id);
  const disponibles = recursos.filter((r) => r.estado_actual === 'DISPONIBLE');
  const inoperativas = recursos.filter((r) => r.estado_actual === 'INOPERATIVO');
  const entradas = bitacora(incidente.timeline, undefined, idioma);
  const totalEventos = entradas.filter((e) => e.tipo === 'evento').length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto overflow-x-hidden">
      {/* Al cambiar de incidente el contenido sale con un fundido y el nuevo entra desde la derecha, sección a sección. */}
      <AnimatePresence mode="wait">
        <motion.div
          key={incidente.id}
          className="flex shrink-0 flex-col"
          variants={{
            entra: { opacity: 0, x: 16 },
            visible: { opacity: 1, x: 0, transition: { ...base, staggerChildren: duracionSegundos('instant') / 2 } },
            sale: { opacity: 0, transition: { duration: duracionSegundos('instant') } },
          }}
          initial="entra"
          animate="visible"
          exit="sale"
        >
          <motion.section variants={SECCION} transition={base} aria-label={t('detalle.ficha')} className="shrink-0">
            <SectionHeader index="01" title={t('detalle.titulo', { codigo: codigoIncidente(incidente.id) })} />
            <div className="px-4 pb-3">
              <h2 className="font-display text-title-sm text-text-primary">{incidente.titulo}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge severity={SEVERIDAD_UI[incidente.nivel_criticidad]}>{textoSeveridad(t, incidente.nivel_criticidad)}</Badge>
                <Badge status={ESTADO_INCIDENTE_UI[incidente.estado]}>{textoEstadoIncidente(t, incidente.estado)}</Badge>
                <span className="font-mono text-data-sm tabular text-text-secondary">
                  {t('detalle.abierto', { duracion: formatearDuracion(minutosAbierto(incidente, ahora)) })}
                </span>
              </div>
              <div role="group" aria-label={t('detalle.estado')} className="mt-3 flex gap-1">
                {ESTADOS_INCIDENTE.filter((e) => e !== incidente.estado).map((e) => (
                  <Button key={e} size="sm" onClick={() => onCambiarEstadoIncidente(incidente, e)}>
                    {t('detalle.marcar', { estado: textoEstadoIncidente(t, e) })}
                  </Button>
                ))}
              </div>
              {(onAbrirDespacho || asesor) && incidente.estado !== 'Resuelto' && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {onAbrirDespacho && (
                    <Button size="sm" variant="secondary" aria-keyshortcuts="D" onClick={onAbrirDespacho}>
                      {t('detalle.despacharUnidad')} <Kbd>D</Kbd>
                    </Button>
                  )}
                  {asesor && (
                    <Button
                      size="sm"
                      variant="secondary"
                      aria-keyshortcuts="A"
                      aria-pressed={asesor.estado.fase !== 'inactivo'}
                      aria-label={t('asesor.boton.aria')} data-tutorial="asesor"
                      onClick={asesor.onAlternar}
                    >
                      {t('asesor.boton')} <Kbd>A</Kbd>
                    </Button>
                  )}
                </div>
              )}
            </div>
          </motion.section>

          {/* La tarjeta del asesor se despliega (altura y opacidad) al abrirse; al cerrarse desaparece sin más. */}
          {asesor && incidente.estado !== 'Resuelto' && asesor.estado.fase !== 'inactivo' && (
            <motion.div
              className="shrink-0 overflow-hidden"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={base}
            >
              <TarjetaAsesor
                estado={asesor.estado}
                reducirMovimiento={reducirMovimiento}
                onAplicar={asesor.onAplicar}
                onDescartar={asesor.onDescartar}
                onCerrar={asesor.onCerrar}
              />
            </motion.div>
          )}

          {perimetro && (
            <motion.div variants={SECCION} transition={base} className="shrink-0">
              <SeccionPerimetro
                indice="02"
                anillos={perimetro.anillos}
                analisis={perimetro.analisis}
                zonas={zonas}
                recursos={recursos}
                indicativos={indicativos}
                onResaltar={onResaltar}
              />
            </motion.div>
          )}

          <motion.section variants={SECCION} transition={base} aria-label={t('detalle.asignadas')} className="shrink-0">
            <SectionHeader index={perimetro ? '03' : '02'} title={t('detalle.asignadas')} count={asignadas.length} />
            {asignadas.length === 0 && <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">{t('detalle.asignadas.vacio')}</p>}
            {/* Una unidad que se asigna o se libera entra o sale abriendo y cerrando su hueco. */}
            <ul>
              <AnimatePresence initial={false}>
                {asignadas.map((r) => (
                  <motion.li
                    key={r.id}
                    className="overflow-hidden"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={base}
                  >
                    {filaDe(r)}
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          </motion.section>

          {!cerrado && (
            <motion.section variants={SECCION} transition={base} aria-label={t('detalle.disponibles.aria')} className="shrink-0">
              <SectionHeader index={perimetro ? '04' : '03'} title={t('detalle.disponibles')} count={disponibles.length} />
              {disponibles.length === 0 ? (
                <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">{t('detalle.disponibles.vacio')}</p>
              ) : (
                <ul>{disponibles.map(fila)}</ul>
              )}
              {inoperativas.length > 0 && (
                <>
                  <p className="px-4 pt-2 font-mono text-overline uppercase text-text-muted">{t('detalle.fuera')}</p>
                  <ul>{inoperativas.map(fila)}</ul>
                </>
              )}
            </motion.section>
          )}

          <motion.section variants={SECCION} transition={base} aria-label={t('detalle.timeline')} className="shrink-0">
            <SectionHeader index={perimetro ? '05' : cerrado ? '03' : '04'} title={t('detalle.timeline')} count={totalEventos} />
            <Bitacora entradas={entradas} sinAutor={t('detalle.sinAutor')} />
          </motion.section>

          <motion.div variants={SECCION} transition={base} className="shrink-0">
            <PanelRefugios zonas={zonas} onCambiarOcupacion={onCambiarOcupacion} indice={perimetro ? '06' : '05'} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
