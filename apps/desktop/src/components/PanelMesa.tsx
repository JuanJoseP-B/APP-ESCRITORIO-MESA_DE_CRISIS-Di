import type { ReactNode } from 'react';
import {
  ESTADOS_INCIDENTE,
  NIVELES_CRITICIDAD,
  etiquetaTipoEmergencia,
  codigoReporte,
  puedeValidarReporte,
  type EstadoIncidente,
  type Incidente,
  type Reporte,
} from '@argos/shared';
import { Button, IncidentCard, Masthead, SectionHeader, type EstadoIncidenteBadge, type SeveridadBadge } from '@argos/ui';
import { eventosVisibles, formatearHora } from '../domain/timeline';
import type { Tema } from '../tema';

interface Props {
  readonly incidentes: readonly Incidente[];
  readonly reportes: readonly Reporte[];
  readonly seleccionadoId: string | null;
  readonly onSeleccionar: (id: string) => void;
  readonly reporteSeleccionadoId?: string | null;
  /** Al elegir un reporte de la bandeja (el mapa se centra en él). */
  readonly onSeleccionarReporte?: (reporte: Reporte) => void;
  readonly dibujando: boolean;
  readonly onAlternarDibujo: () => void;
  readonly onConfirmarReporte?: (reporte: Reporte) => void;
  readonly onDescartarReporte?: (reporte: Reporte) => void;
  readonly onCambiarEstadoIncidente?: (incidente: Incidente, estado: EstadoIncidente) => void;
  readonly onCerrarSesion?: () => void;
  /** Turno visual actual y su alternador (crema/carbón). */
  readonly tema?: Tema;
  readonly onAlternarTema?: () => void;
  /** Secciones adicionales (p. ej. recursos) entre la lista de incidentes y el timeline. */
  readonly children?: ReactNode;
}

const SEVERIDAD_UI: Record<Incidente['nivel_criticidad'], SeveridadBadge> = {
  Crítico: 'critico',
  Medio: 'medio',
  Bajo: 'bajo',
};

const ESTADO_UI: Record<EstadoIncidente, EstadoIncidenteBadge> = {
  Abierto: 'abierto',
  Contenido: 'contenido',
  Resuelto: 'resuelto',
};

/** Más crítico primero; a igual criticidad, los no resueltos antes. */
export function ordenarIncidentes(incidentes: readonly Incidente[]): readonly Incidente[] {
  const peso = (i: Incidente) => NIVELES_CRITICIDAD.indexOf(i.nivel_criticidad);
  return [...incidentes].sort(
    (a, b) =>
      peso(b) - peso(a) || Number(a.estado === 'Resuelto') - Number(b.estado === 'Resuelto'),
  );
}

/** Los más recientes primero; los que no traen fecha de recepción quedan al final. */
export function ordenarReportes(reportes: readonly Reporte[]): readonly Reporte[] {
  return [...reportes].sort((a, b) => (b.creado_en ?? '').localeCompare(a.creado_en ?? ''));
}

export function PanelMesa({
  incidentes,
  reportes,
  seleccionadoId,
  onSeleccionar,
  reporteSeleccionadoId,
  onSeleccionarReporte,
  dibujando,
  onAlternarDibujo,
  onConfirmarReporte,
  onDescartarReporte,
  onCambiarEstadoIncidente,
  onCerrarSesion,
  tema,
  onAlternarTema,
  children,
}: Props) {
  const ordenados = ordenarIncidentes(incidentes);
  const seleccionado = incidentes.find((i) => i.id === seleccionadoId);
  const pendientes = ordenarReportes(reportes.filter(puedeValidarReporte));

  return (
    <aside className="relative z-panel flex h-full w-panel flex-col overflow-y-auto bg-surface-panel text-text-primary shadow-panel">
      <Masthead
        kicker="ARGOS"
        title="Mesa de Crisis"
        actions={
          <>
            <Button variant="inverse" size="sm" onClick={onAlternarDibujo} aria-pressed={dibujando}>
              {dibujando ? 'Cancelar trazado' : 'Trazar zona'}
            </Button>
            {onAlternarTema && (
              <Button variant="inverse" size="sm" onClick={onAlternarTema}>
                {tema === 'carbon' ? 'Turno día' : 'Turno noche'}
              </Button>
            )}
            {onCerrarSesion && (
              <Button variant="inverse" size="sm" onClick={onCerrarSesion}>
                Salir
              </Button>
            )}
          </>
        }
      />

      <section
        aria-label="Bandeja de Reportes Entrantes"
        className={`max-h-56 shrink-0 overflow-y-auto ${pendientes.length > 0 ? 'bg-status-warning-bg' : ''}`}
      >
        <SectionHeader index="01" title="Reportes entrantes" count={`${pendientes.length} sin confirmar`} />
        {pendientes.length === 0 ? (
          <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">Sin reportes pendientes</p>
        ) : (
          <ul className="pb-2 font-mono text-data-sm">
            {pendientes.map((r) => (
              <li
                key={r.id}
                className={`flex items-center gap-2 px-4 py-1 ${r.id === reporteSeleccionadoId ? 'bg-surface-selected' : ''}`}
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
                  {etiquetaTipoEmergencia(r.tipo)} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                </button>
                {r.imagen_url && (
                  <a href={r.imagen_url} target="_blank" rel="noreferrer" className="rounded-xs text-text-accent underline">
                    Foto
                  </a>
                )}
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
        )}
      </section>

      <SectionHeader index="02" title="Incidentes" count={ordenados.length} />
      <ul aria-label="Incidentes" className="flex shrink-0 flex-col gap-2 px-4 pb-4">
        {ordenados.map((i) => (
          <li key={i.id}>
            <IncidentCard
              title={i.titulo}
              severity={SEVERIDAD_UI[i.nivel_criticidad]}
              status={ESTADO_UI[i.estado]}
              time={eventosVisibles(i.timeline)[0]?.hora}
              selected={i.id === seleccionadoId}
              onSelect={() => onSeleccionar(i.id)}
            />
          </li>
        ))}
      </ul>

      {children}

      {seleccionado && (
        <section aria-label="Timeline" className="shrink-0">
          <SectionHeader index="05" title="Línea de tiempo" />
          <div className="px-4 pb-3">
            <h3 className="mb-2 font-display text-title-sm text-text-primary">{seleccionado.titulo}</h3>
            {onCambiarEstadoIncidente && (
              <div role="group" aria-label="Estado del incidente" className="mb-2 flex gap-1">
                {ESTADOS_INCIDENTE.filter((e) => e !== seleccionado.estado).map((e) => (
                  <Button key={e} size="sm" onClick={() => onCambiarEstadoIncidente(seleccionado, e)}>
                    Marcar {e}
                  </Button>
                ))}
              </div>
            )}
            <ol className="space-y-1 font-mono text-data-sm text-text-secondary">
              {eventosVisibles(seleccionado.timeline).map((e, n) => (
                <li key={`${n}-${e.descripcion}`}>
                  <time dateTime={e.iso ?? undefined} className="mr-2 font-bold tabular text-text-primary">
                    {e.hora}
                  </time>
                  {e.descripcion}
                </li>
              ))}
            </ol>
          </div>
        </section>
      )}
    </aside>
  );
}
