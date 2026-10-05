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
import { COLOR_CRITICIDAD } from '../domain/geojson';
import { eventosVisibles, formatearHora } from '../domain/timeline';

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
  /** Secciones adicionales (p. ej. recursos) entre la lista de incidentes y el timeline. */
  readonly children?: ReactNode;
}

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
  children,
}: Props) {
  const ordenados = ordenarIncidentes(incidentes);
  const seleccionado = incidentes.find((i) => i.id === seleccionadoId);
  const pendientes = ordenarReportes(reportes.filter(puedeValidarReporte));
  const botonAccion = 'border border-linea px-1.5 py-0.5 font-mono text-xs uppercase hover:border-texto';

  return (
    <aside className="flex h-full w-96 flex-col border-r border-linea bg-superficie text-texto">
      <header className="flex items-center justify-between border-b border-linea px-3 py-2">
        <h1 className="text-lg font-bold tracking-tight">ARGOS · Mesa de Crisis</h1>
        <button
          type="button"
          onClick={onAlternarDibujo}
          aria-pressed={dibujando}
          className={`border px-2 py-1 font-mono text-xs uppercase ${
            dibujando ? 'border-critico bg-critico text-white' : 'border-linea hover:border-texto'
          }`}
        >
          {dibujando ? 'Cancelar trazado' : 'Trazar zona'}
        </button>
        {onCerrarSesion && (
          <button type="button" onClick={onCerrarSesion} className={botonAccion}>
            Salir
          </button>
        )}
      </header>

      <section
        aria-label="Bandeja de Reportes Entrantes"
        className={`max-h-56 overflow-y-auto border-b border-linea px-3 py-2 ${pendientes.length > 0 ? 'bg-advertencia/15' : ''}`}
      >
        <h2 className="font-mono text-xs font-bold uppercase">
          Reportes entrantes · {pendientes.length} sin confirmar
        </h2>
        {pendientes.length === 0 ? (
          <p className="mt-1 font-mono text-xs">Sin reportes pendientes</p>
        ) : (
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {pendientes.map((r) => (
              <li
                key={r.id}
                className={`flex items-center gap-2 ${r.id === reporteSeleccionadoId ? 'bg-advertencia/30' : ''}`}
              >
                <button
                  type="button"
                  aria-label={`Ver reporte ${r.id} en el mapa`}
                  aria-current={r.id === reporteSeleccionadoId}
                  onClick={() => onSeleccionarReporte?.(r)}
                  className="flex-1 text-left hover:underline"
                >
                  {r.creado_en && (
                    <time dateTime={r.creado_en} className="mr-2 font-bold">
                      {formatearHora(r.creado_en)}
                    </time>
                  )}
                  <span className="mr-2 font-bold">#{codigoReporte(r.id)}</span>
                  {etiquetaTipoEmergencia(r.tipo)} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
                </button>
                {r.imagen_url && (
                  <a href={r.imagen_url} target="_blank" rel="noreferrer" className="underline">
                    Foto
                  </a>
                )}
                {onConfirmarReporte && (
                  <button type="button" aria-label={`Confirmar reporte ${r.id}`} onClick={() => onConfirmarReporte(r)} className={botonAccion}>
                    Confirmar
                  </button>
                )}
                {onDescartarReporte && (
                  <button type="button" aria-label={`Descartar reporte ${r.id}`} onClick={() => onDescartarReporte(r)} className={botonAccion}>
                    Descartar
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <ul aria-label="Incidentes" className="flex-1 overflow-y-auto">
        {ordenados.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() => onSeleccionar(i.id)}
              aria-current={i.id === seleccionadoId}
              className={`flex w-full items-center gap-2 border-b border-linea px-3 py-2 text-left ${
                i.id === seleccionadoId ? 'bg-base' : 'hover:bg-base'
              }`}
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0"
                style={{ backgroundColor: COLOR_CRITICIDAD[i.nivel_criticidad] }}
              />
              <span className="flex-1 truncate text-sm font-medium">{i.titulo}</span>
              <span className="font-mono text-xs uppercase">
                {i.nivel_criticidad} · {i.estado}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {children}

      {seleccionado && (
        <section aria-label="Timeline" className="max-h-64 overflow-y-auto border-t border-linea px-3 py-2">
          <h2 className="mb-1 text-sm font-bold">{seleccionado.titulo}</h2>
          {onCambiarEstadoIncidente && (
            <div role="group" aria-label="Estado del incidente" className="mb-2 flex gap-1">
              {ESTADOS_INCIDENTE.filter((e) => e !== seleccionado.estado).map((e) => (
                <button key={e} type="button" onClick={() => onCambiarEstadoIncidente(seleccionado, e)} className={botonAccion}>
                  Marcar {e}
                </button>
              ))}
            </div>
          )}
          <ol className="space-y-1 font-mono text-xs">
            {eventosVisibles(seleccionado.timeline).map((e, n) => (
              <li key={`${n}-${e.descripcion}`}>
                <time dateTime={e.iso ?? undefined} className="mr-2 font-bold">
                  {e.hora}
                </time>
                {e.descripcion}
              </li>
            ))}
          </ol>
        </section>
      )}
    </aside>
  );
}
