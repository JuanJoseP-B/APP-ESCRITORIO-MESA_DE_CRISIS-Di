import { useState } from 'react';
import type { Incidente, Llamada, Recurso } from '@argos/shared';
import { Glyph, SEVERIDADES, type SeveridadBadge } from '@argos/ui';
import { codigoIncidente, dividirCola, minutosAbierto, unidadesPorIncidente } from '../domain/cola';
import { BandejaEntrantes } from './BandejaEntrantes';
import { SEVERIDAD_UI } from './presentacion';

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
}

const COLOR_SEVERIDAD: Record<SeveridadBadge, string> = {
  critico: 'text-status-critical',
  alto: 'text-status-critical',
  medio: 'text-status-warning',
  bajo: 'text-text-secondary',
};

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
  ahora,
  seleccionado,
  cerrado,
  onSeleccionar,
}: {
  incidente: Incidente;
  unidades: number;
  ahora: number;
  seleccionado: boolean;
  cerrado: boolean;
  onSeleccionar: () => void;
}) {
  const severidad = SEVERIDAD_UI[incidente.nivel_criticidad];
  const preset = SEVERIDADES[severidad];
  const codigo = codigoIncidente(incidente.id);
  return (
    <button
      type="button"
      aria-pressed={seleccionado}
      aria-label={`${incidente.titulo}, ${preset.label}, ${incidente.estado}, ${unidades} unidades`}
      onClick={onSeleccionar}
      className={`grid w-full min-h-row grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 border-b border-border-subtle px-4 py-2 text-left hover:bg-surface-hover ${seleccionado ? 'bg-surface-selected outline outline-1 -outline-offset-1 outline-border-strong' : ''}`}
    >
      <span className={`flex items-center gap-2 font-mono text-overline uppercase ${cerrado ? 'text-text-muted' : COLOR_SEVERIDAD[severidad]}`}>
        <Glyph shape={preset.shape} />
        {preset.label}
      </span>
      <span className="font-mono text-data-sm font-semibold tabular text-text-primary">#{codigo}</span>
      <span className="font-mono text-data-sm tabular text-text-secondary">
        {formatearDuracion(minutosAbierto(incidente, ahora))}
      </span>
      <span className={`col-span-2 line-clamp-2 font-ui text-body-sm ${cerrado ? 'text-text-muted' : 'text-text-primary'}`}>
        {incidente.titulo}
      </span>
      <span className="font-mono text-data-sm tabular text-text-secondary">
        {unidades} U{cerrado ? ` · ${incidente.estado}` : ''}
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
}: ColaIncidentesProps) {
  const [pestana, setPestana] = useState<Pestana>('activos');
  const { activos, cerrados } = dividirCola(incidentes);
  const unidades = unidadesPorIncidente(recursos);
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

      <div role="tablist" aria-label="Incidentes" className="flex shrink-0 border-y border-border-strong">
        {(
          [
            ['activos', 'Activos', activos.length],
            ['cerrados', 'Cerrados', cerrados.length],
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
            {pestana === 'activos' ? 'Sin incidentes activos' : 'Sin incidentes cerrados'}
          </p>
        ) : (
          <ul aria-label={pestana === 'activos' ? 'Incidentes activos' : 'Incidentes cerrados'}>
            {visibles.map((i) => (
              <li key={i.id}>
                <FilaIncidente
                  incidente={i}
                  unidades={unidades.get(i.id) ?? 0}
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
