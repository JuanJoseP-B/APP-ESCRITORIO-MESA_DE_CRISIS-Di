import { NIVELES_CRITICIDAD, type Incidente, type Reporte } from '@argos/shared';
import { COLOR_CRITICIDAD } from '../domain/geojson';

interface Props {
  readonly incidentes: readonly Incidente[];
  readonly reportes: readonly Reporte[];
  readonly seleccionadoId: string | null;
  readonly onSeleccionar: (id: string) => void;
  readonly dibujando: boolean;
  readonly onAlternarDibujo: () => void;
}

/** Más crítico primero; a igual criticidad, los no resueltos antes. */
export function ordenarIncidentes(incidentes: readonly Incidente[]): readonly Incidente[] {
  const peso = (i: Incidente) => NIVELES_CRITICIDAD.indexOf(i.nivel_criticidad);
  return [...incidentes].sort(
    (a, b) =>
      peso(b) - peso(a) || Number(a.estado === 'Resuelto') - Number(b.estado === 'Resuelto'),
  );
}

const formatearHora = (iso: string): string =>
  new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit', hour12: false });

export function PanelMesa({
  incidentes,
  reportes,
  seleccionadoId,
  onSeleccionar,
  dibujando,
  onAlternarDibujo,
}: Props) {
  const ordenados = ordenarIncidentes(incidentes);
  const seleccionado = incidentes.find((i) => i.id === seleccionadoId);
  const pendientes = reportes.filter((r) => r.estado_validacion === 'No confirmado');

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
      </header>

      {pendientes.length > 0 && (
        <section aria-label="Alertas" className="border-b border-linea bg-advertencia/15 px-3 py-2">
          <p className="font-mono text-xs font-bold uppercase">
            {pendientes.length} reporte(s) sin confirmar
          </p>
          <ul className="mt-1 space-y-0.5 font-mono text-xs">
            {pendientes.map((r) => (
              <li key={r.id}>
                {r.tipo} · {r.lat.toFixed(4)}, {r.lng.toFixed(4)}
              </li>
            ))}
          </ul>
        </section>
      )}

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

      {seleccionado && (
        <section aria-label="Timeline" className="max-h-64 overflow-y-auto border-t border-linea px-3 py-2">
          <h2 className="mb-1 text-sm font-bold">{seleccionado.titulo}</h2>
          <ol className="space-y-1 font-mono text-xs">
            {seleccionado.timeline.map((e) => (
              <li key={`${e.timestamp}-${e.descripcion}`}>
                <time dateTime={e.timestamp} className="mr-2 font-bold">
                  {formatearHora(e.timestamp)}
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
