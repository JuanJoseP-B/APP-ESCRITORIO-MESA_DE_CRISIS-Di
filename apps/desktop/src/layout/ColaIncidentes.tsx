import { useState } from 'react';
import {
  codigoReporte,
  etiquetaTipoEmergencia,
  puedeValidarReporte,
  type Incidente,
  type Recurso,
  type Reporte,
} from '@argos/shared';
import { Button, Glyph, SEVERIDADES, SectionHeader, type SeveridadBadge } from '@argos/ui';
import { codigoIncidente, dividirCola, minutosAbierto, unidadesPorIncidente } from '../domain/cola';
import { formatearHora } from '../domain/timeline';
import { SEVERIDAD_UI } from './presentacion';

export interface ColaIncidentesProps {
  incidentes: readonly Incidente[];
  recursos: readonly Recurso[];
  reportes: readonly Reporte[];
  /** Hora corregida (ms epoch) para calcular el tiempo abierto. */
  ahora: number;
  seleccionadoId: string | null;
  onSeleccionar: (id: string) => void;
  reporteSeleccionadoId?: string | null;
  onSeleccionarReporte?: (reporte: Reporte) => void;
  onConfirmarReporte?: (reporte: Reporte) => void;
  onDescartarReporte?: (reporte: Reporte) => void;
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

/** B · cola de incidentes: activos por prioridad, pestaña de cerrados y bandeja de llamadas por confirmar. */
export function ColaIncidentes({
  incidentes,
  recursos,
  reportes,
  ahora,
  seleccionadoId,
  onSeleccionar,
  reporteSeleccionadoId,
  onSeleccionarReporte,
  onConfirmarReporte,
  onDescartarReporte,
}: ColaIncidentesProps) {
  const [pestana, setPestana] = useState<Pestana>('activos');
  const [bandejaAbierta, setBandejaAbierta] = useState(true);
  const { activos, cerrados } = dividirCola(incidentes);
  const unidades = unidadesPorIncidente(recursos);
  const pendientes = [...reportes.filter(puedeValidarReporte)].sort((a, b) =>
    (b.creado_en ?? '').localeCompare(a.creado_en ?? ''),
  );
  const visibles = pestana === 'activos' ? activos : cerrados;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <section aria-label="Bandeja de llamadas entrantes" className={`shrink-0 ${pendientes.length > 0 ? 'bg-status-warning-bg' : ''}`}>
        <div className="flex items-center">
          <div className="flex-1">
            <SectionHeader index="01" title="Llamadas entrantes" count={`${pendientes.length} sin confirmar`} />
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="mr-2"
            aria-expanded={bandejaAbierta}
            onClick={() => setBandejaAbierta((a) => !a)}
          >
            {bandejaAbierta ? 'Plegar' : 'Desplegar'}
          </Button>
        </div>
        {bandejaAbierta &&
          (pendientes.length === 0 ? (
            <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">Sin llamadas pendientes</p>
          ) : (
            <ul className="max-h-40 overflow-y-auto pb-2 font-mono text-data-sm">
              {pendientes.map((r) => (
                <li
                  key={r.id}
                  className={`flex flex-wrap items-center gap-2 px-4 py-1 ${r.id === reporteSeleccionadoId ? 'bg-surface-selected' : ''}`}
                >
                  <button
                    type="button"
                    aria-label={`Ver reporte ${r.id} en el mapa`}
                    aria-current={r.id === reporteSeleccionadoId}
                    onClick={() => onSeleccionarReporte?.(r)}
                    className="flex-1 rounded-xs text-left text-text-primary hover:underline"
                  >
                    {r.creado_en && (
                      <time dateTime={r.creado_en} className="mr-2 font-bold tabular">
                        {formatearHora(r.creado_en)}
                      </time>
                    )}
                    <span className="mr-2 font-bold tabular">#{codigoReporte(r.id)}</span>
                    {etiquetaTipoEmergencia(r.tipo)}
                  </button>
                  {onConfirmarReporte && (
                    <Button size="sm" aria-label={`Confirmar reporte ${r.id}`} onClick={() => onConfirmarReporte(r)}>
                      Confirmar
                    </Button>
                  )}
                  {onDescartarReporte && (
                    <Button size="sm" aria-label={`Descartar reporte ${r.id}`} onClick={() => onDescartarReporte(r)}>
                      Descartar
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          ))}
      </section>

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
