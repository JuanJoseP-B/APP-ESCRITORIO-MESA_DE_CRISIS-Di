import {
  ESTADOS_RECURSO,
  TRANSICIONES_RECURSO,
  type EstadoRecurso,
  type Recurso,
} from '@argos/shared';

interface Props {
  readonly recursos: readonly Recurso[];
  /** Incidente al que se asignan los recursos que se despachen. */
  readonly incidenteSeleccionadoId: string | null;
  readonly onCambiarEstado: (recurso: Recurso, estado: EstadoRecurso) => void;
}

const COLOR_ESTADO: Record<EstadoRecurso, string> = {
  Disponible: 'bg-ok',
  Despachado: 'bg-advertencia',
  'En Escena': 'bg-critico',
  Inoperativo: 'bg-linea',
};

const ETIQUETA_ACCION: Record<EstadoRecurso, string> = {
  Disponible: 'Liberar',
  Despachado: 'Despachar',
  'En Escena': 'En escena',
  Inoperativo: 'Inoperativo',
};

export function PanelRecursos({ recursos, incidenteSeleccionadoId, onCambiarEstado }: Props) {
  return (
    <section aria-label="Recursos" className="max-h-72 overflow-y-auto border-t border-linea">
      <h2 className="px-3 pt-2 font-mono text-xs font-bold uppercase">Recursos operativos</h2>
      {ESTADOS_RECURSO.map((estado) => {
        const grupo = recursos.filter((r) => r.estado_actual === estado);
        return (
          <div key={estado} role="group" aria-label={estado} className="px-3 py-1">
            <p className="flex items-center gap-2 font-mono text-xs uppercase">
              <span aria-hidden className={`size-2 ${COLOR_ESTADO[estado]}`} />
              {estado} ({grupo.length})
            </p>
            <ul className="mt-1 space-y-1">
              {grupo.map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-sm">
                  <span className="flex-1 truncate">
                    {r.tipo} <span className="font-mono text-xs">{r.etiqueta ?? r.id}</span>
                  </span>
                  {TRANSICIONES_RECURSO[r.estado_actual].map((destino) => {
                    const sinIncidente = destino === 'Despachado' && !incidenteSeleccionadoId;
                    return (
                      <button
                        key={destino}
                        type="button"
                        disabled={sinIncidente}
                        title={sinIncidente ? 'Selecciona un incidente para despachar' : undefined}
                        aria-label={`${ETIQUETA_ACCION[destino]} ${r.id}`}
                        onClick={() => onCambiarEstado(r, destino)}
                        className="border border-linea px-2 py-0.5 font-mono text-xs uppercase hover:border-texto disabled:opacity-40"
                      >
                        {ETIQUETA_ACCION[destino]}
                      </button>
                    );
                  })}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
