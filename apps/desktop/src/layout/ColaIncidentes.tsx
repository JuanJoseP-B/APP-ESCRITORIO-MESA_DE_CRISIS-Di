import { useState } from 'react';
import type { Incidente, Llamada, Recurso } from '@argos/shared';
import { Badge, Button } from '@argos/ui';
import { codigoIncidente, dividirCola, filtrarPorIds, minutosAbierto, unidadesPorIncidente } from '../domain/cola';
import { llamadasPorIncidente } from '../domain/entrantes';
import { textoEstadoIncidente } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { BandejaEntrantes } from './BandejaEntrantes';
import { PRIORIDAD_UI } from './presentacion';

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
  unidades: number;
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
  return (
    <button
      type="button"
      aria-pressed={seleccionado}
      aria-label={t('cola.fila.aria', { titulo: incidente.titulo, prioridad: incidente.prioridad, estado, unidades, llamadas })}
      onClick={onSeleccionar}
      className={`grid w-full min-h-row grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-2 text-left hover:bg-surface-hover ${seleccionado ? 'bg-surface-selected outline outline-1 -outline-offset-1 outline-border-strong' : ''}`}
    >
      <span>
        {cerrado ? (
          <Badge tone="neutral" emphasis="outline">
            {incidente.prioridad}
          </Badge>
        ) : (
          <Badge tone={prioridad.tone} emphasis={prioridad.emphasis}>
            {incidente.prioridad}
          </Badge>
        )}
      </span>
      <span className="font-mono text-data-sm font-semibold tabular text-text-primary">#{codigo}</span>
      <span className="font-mono text-data-sm tabular text-text-secondary">
        {formatearDuracion(minutosAbierto(incidente, ahora))}
      </span>
      <span className={`col-span-2 line-clamp-2 font-ui text-body-sm ${cerrado ? 'text-text-muted' : 'text-text-primary'}`}>
        {incidente.titulo}
      </span>
      <span className="font-mono text-data-sm tabular text-text-secondary">
        {unidades} U{cerrado ? ` · ${estado}` : ''}
      </span>
      {llamadas > 0 && (
        <span className="justify-self-end">
          <Badge tone="neutral" emphasis="outline" glyph={false}>
            <span role="img" aria-label={llamadas === 1 ? t('cola.llamadas.una') : t('cola.llamadas.varias', { n: llamadas })} className="font-mono tabular">
              <span aria-hidden="true">☎</span> {llamadas}
            </span>
          </Badge>
        </span>
      )}
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
  const unidades = unidadesPorIncidente(recursos);
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
        <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border-strong px-4 py-1">
          <span className="font-mono text-overline uppercase text-text-primary">{t('cola.filtro.sla')}</span>
          <Button size="sm" variant="ghost" aria-label={t('cola.filtro.sla.quitar')} title={t('cola.filtro.sla.quitar')} onClick={filtroSla.onQuitar}>
            <span aria-hidden="true">✕</span>
          </Button>
        </div>
      )}

      <div role="tablist" aria-label={t('cola.tabs.aria')} className="flex shrink-0 border-y border-border-strong">
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
            className={`flex-1 px-4 py-2 font-mono text-overline uppercase ${pestana === id ? 'bg-surface-selected text-text-primary' : 'text-text-secondary hover:bg-surface-hover'}`}
          >
            {nombre} <span className="tabular">({cuenta})</span>
          </button>
        ))}
      </div>

      <div id="lista-incidentes" role="tabpanel" aria-labelledby={`pestana-${pestana}`} className="min-h-0 flex-1 overflow-y-auto">
        {visibles.length === 0 ? (
          <p className="px-4 py-3 font-mono text-data-sm text-text-muted">
            {filtroSla ? t('cola.filtro.vacio') : pestana === 'activos' ? t('cola.activos.vacio') : t('cola.cerrados.vacio')}
          </p>
        ) : (
          <ul aria-label={pestana === 'activos' ? t('cola.activos.lista') : t('cola.cerrados.lista')}>
            {visibles.map((i) => (
              <li key={i.id}>
                <FilaIncidente
                  incidente={i}
                  unidades={unidades.get(i.id) ?? 0}
                  llamadas={vinculadas.get(i.id) ?? 0}
                  ahora={ahora}
                  seleccionado={i.id === seleccionadoId}
                  cerrado={pestana === 'cerrados'}
                  onSeleccionar={() => onSeleccionar(i.id)}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
