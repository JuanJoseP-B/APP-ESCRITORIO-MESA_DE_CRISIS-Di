import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { Incidente, Llamada, Recurso } from '@argos/shared';
import { Badge, curva, duracion, duracionSegundos } from '@argos/ui';
import { codigoIncidente, dividirCola, filtrarPorIds, minutosAbierto, unidadesPorEstadoDeIncidente, type UnidadesDeIncidente } from '../domain/cola';
import { llamadasPorIncidente } from '../domain/entrantes';
import { textoEstadoIncidente } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { BandejaEntrantes } from './BandejaEntrantes';
import { PRIORIDAD_UI } from './presentacion';
import './ColaIncidentes.css';

export interface ColaIncidentesProps {
  incidentes: readonly Incidente[];
  recursos: readonly Recurso[];
  llamadas: readonly Llamada[];
  /** Hora corregida (ms epoch) para calcular el tiempo abierto y la espera de las llamadas. */
  ahora: number;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  /** Llamada que el formulario tiene abierta. */
  llamadaAbiertaId?: string | null;
  onAbrirLlamada: (llamada: Llamada) => void;
  onDescartarLlamada?: (llamada: Llamada) => void;
  /** Filtro por SLA: solo los incidentes con unidades en riesgo; `onQuitar` lo retira. `null` = sin filtro. */
  filtroSla?: { readonly incidentes: ReadonlySet<string>; readonly onQuitar: () => void } | null;
}

/** "12 min", "2 h 05 min" o "—" cuando no se conoce la apertura. */
export function formatearDuracion(minutos: number | null): string {
  if (minutos === null) return '—';
  if (minutos < 60) return `${minutos} min`;
  return `${Math.floor(minutos / 60)} h ${String(minutos % 60).padStart(2, '0')} min`;
}

type Pestana = 'activos' | 'cerrados';

const SIN_UNIDADES: UnidadesDeIncidente = { total: 0, enRuta: 0, enEscena: 0 };

function FilaIncidente({
  incidente,
  unidades,
  llamadas,
  ahora,
  seleccionado,
  cerrado,
  onSeleccionar,
}: {
  incidente: Incidente;
  unidades: UnidadesDeIncidente;
  /** Llamadas vinculadas al incidente. */
  llamadas: number;
  ahora: number;
  seleccionado: boolean;
  cerrado: boolean;
  onSeleccionar: () => void;
}) {
  const { t } = useTexto();
  const prioridad = PRIORIDAD_UI[incidente.prioridad];
  const estado = textoEstadoIncidente(t, incidente.estado);
  const codigo = codigoIncidente(incidente.id);
  // J/K cambian la selección sin tocar el scroll de la lista: la fila elegida se acerca a la vista.
  const fila = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (seleccionado) fila.current?.scrollIntoView?.({ block: 'nearest' });
  }, [seleccionado]);

  const previoLlamadas = useRef(llamadas);
  const [saltoLlamadas, setSaltoLlamadas] = useState(false);
  useEffect(() => {
    if (llamadas > previoLlamadas.current) {
      setSaltoLlamadas(true);
      const timer = setTimeout(() => setSaltoLlamadas(false), duracion('base') || 240);
      previoLlamadas.current = llamadas;
      return () => clearTimeout(timer);
    }
    previoLlamadas.current = llamadas;
  }, [llamadas]);

  return (
    <button
      ref={fila}
      type="button"
      aria-pressed={seleccionado}
      aria-label={t('cola.fila.aria', { titulo: incidente.titulo, prioridad: incidente.prioridad, estado, unidades: unidades.total, llamadas })}
      onClick={onSeleccionar}
      data-seleccionado={seleccionado || undefined}
      data-cerrado={cerrado || undefined}
      className="ag-incidente"
    >
      {/* La tarjeta oscura del incidente activo es un solo elemento que viaja de una fila a otra. */}
      {seleccionado && (
        <motion.span
          layoutId="cola-seleccion"
          aria-hidden="true"
          data-seleccion
          className="ag-incidente__fondo"
          transition={{ duration: duracionSegundos('base'), ease: curva('salida') }}
        />
      )}
      <span className="flex items-center gap-2">
        {cerrado ? (
          <Badge tone="neutral" emphasis="outline">
            {incidente.prioridad}
          </Badge>
        ) : (
          <Badge tone={prioridad.tone} emphasis={prioridad.emphasis}>
            {incidente.prioridad}
          </Badge>
        )}
        <span className="font-mono text-[13px] font-bold tabular">#{codigo}</span>
        <span className="ag-incidente__tenue ml-auto font-mono text-[11px] tabular">{formatearDuracion(minutosAbierto(incidente, ahora))}</span>
      </span>
      <span className={`line-clamp-2 text-[14px] font-medium leading-[1.35] ${cerrado ? 'text-text-muted' : ''}`}>{incidente.titulo}</span>
      <span className="flex flex-wrap items-center gap-2">
        {unidades.enRuta > 0 && (
          <span className="ag-mini-chip ag-mini-chip--ruta">
            <span aria-hidden="true">▲</span> {t('cola.chip.enRuta', { n: unidades.enRuta })}
          </span>
        )}
        {unidades.enEscena > 0 && (
          <span className="ag-mini-chip ag-mini-chip--escena">
            <span aria-hidden="true">◆</span> {t('cola.chip.enEscena', { n: unidades.enEscena })}
          </span>
        )}
        {unidades.total === 0 && (
          <span className="ag-mini-chip ag-mini-chip--neutro">
            <span aria-hidden="true">○</span> {t('cola.chip.sinUnidades')}
          </span>
        )}
        {cerrado && <span className="ag-mini-chip ag-mini-chip--neutro">{estado}</span>}
        {llamadas > 0 && (
          <span className={`ag-mini-chip ag-mini-chip--neutro ${saltoLlamadas ? 'ag-badge-salto' : ''}`} data-salto={saltoLlamadas || undefined}>
            <span role="img" aria-label={llamadas === 1 ? t('cola.llamadas.una') : t('cola.llamadas.varias', { n: llamadas })} className="font-mono tabular">
              <span aria-hidden="true">☎</span> {llamadas}
            </span>
          </span>
        )}
      </span>
    </button>
  );
}

/** B · cola de incidentes: bandeja de entrantes, activos por prioridad y pestaña de cerrados. */
export function ColaIncidentes({
  incidentes,
  recursos,
  llamadas,
  ahora,
  seleccionadoId,
  onSeleccionar,
  llamadaAbiertaId,
  onAbrirLlamada,
  onDescartarLlamada,
  filtroSla = null,
}: ColaIncidentesProps) {
  const { t } = useTexto();
  const [pestana, setPestana] = useState<Pestana>('activos');
  const dividida = dividirCola(incidentes);
  const ids = filtroSla?.incidentes ?? null;
  const activos = filtrarPorIds(dividida.activos, ids);
  const cerrados = filtrarPorIds(dividida.cerrados, ids);
  const unidades = unidadesPorEstadoDeIncidente(recursos);
  const vinculadas = llamadasPorIncidente(llamadas);
  const visibles = pestana === 'activos' ? activos : cerrados;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <BandejaEntrantes
        llamadas={llamadas}
        ahora={ahora}
        abiertaId={llamadaAbiertaId}
        onAbrir={onAbrirLlamada}
        onDescartar={onDescartarLlamada}
      />

      {filtroSla && (
        <div className="ag-filtro-sla mx-4 mb-1 mt-1 flex shrink-0 items-center justify-between gap-2">
          <span className="font-mono text-[11px] font-bold uppercase tracking-[.04em]">{t('cola.filtro.sla')}</span>
          <button type="button" className="ag-btn-mini" aria-label={t('cola.filtro.sla.quitar')} title={t('cola.filtro.sla.quitar')} onClick={filtroSla.onQuitar}>
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      )}

      <div role="tablist" aria-label={t('cola.tabs.aria')} className="ag-pestanas mx-4 mt-2 shrink-0">
        {(
          [
            ['activos', t('cola.activos'), activos.length],
            ['cerrados', t('cola.cerrados'), cerrados.length],
          ] as const
        ).map(([id, nombre, cuenta]) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`pestana-${id}`}
            aria-selected={pestana === id}
            aria-controls="lista-incidentes"
            onClick={() => setPestana(id)}
            className="ag-pestanas__opt"
          >
            {/* El thumb de la pestaña activa es un solo elemento que se desliza de una a otra. */}
            {pestana === id && (
              <motion.span
                layoutId="cola-pestana-activa"
                aria-hidden="true"
                className="ag-pestanas__thumb"
                transition={{ duration: duracionSegundos('base'), ease: curva('salida') }}
              />
            )}
            <span className="relative">
              {nombre} <span className="tabular">({cuenta})</span>
            </span>
          </button>
        ))}
      </div>

      <div id="lista-incidentes" role="tabpanel" aria-labelledby={`pestana-${pestana}`} className="ag-scroll-fino min-h-0 flex-1 overflow-y-auto px-4 pb-3 pt-3">
        {visibles.length === 0 ? (
          <p className="py-1 font-mono text-data-sm text-[var(--isla-texto-2)]">
            {filtroSla ? t('cola.filtro.vacio') : pestana === 'activos' ? t('cola.activos.vacio') : t('cola.cerrados.vacio')}
          </p>
        ) : (
          <ul key={pestana} aria-label={pestana === 'activos' ? t('cola.activos.lista') : t('cola.cerrados.lista')} className="flex flex-col gap-2">
            <AnimatePresence initial={false}>
              {visibles.map((i) => (
                <motion.li
                  key={i.id}
                  layout
                  layoutId={`incidente-${i.id}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0, overflow: 'hidden' }}
                  transition={{ duration: duracionSegundos('base'), ease: curva('salida') }}
                >
                  <FilaIncidente
                    incidente={i}
                    unidades={unidades.get(i.id) ?? SIN_UNIDADES}
                    llamadas={vinculadas.get(i.id) ?? 0}
                    ahora={ahora}
                    seleccionado={i.id === seleccionadoId}
                    cerrado={pestana === 'cerrados'}
                    onSeleccionar={() => onSeleccionar(i.id)}
                  />
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {seleccionadoId === null && pestana === 'activos' && activos.length > 0 && (
        <p className="shrink-0 px-4 pb-4 text-[12px] leading-[1.5] text-[var(--isla-texto-2)]">{t('cola.ayuda')}</p>
      )}
    </div>
  );
}
