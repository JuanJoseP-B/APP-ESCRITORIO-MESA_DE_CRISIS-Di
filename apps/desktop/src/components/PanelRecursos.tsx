import {
  ESTADOS_RECURSO,
  TRANSICIONES_RECURSO,
  type EstadoRecurso,
  type Recurso,
} from '@argos/shared';
import { Button, DispatchRow, SectionHeader, StatusIndicator, type EstadoRecursoUI, type VarianteBoton } from '@argos/ui';

interface Props {
  readonly recursos: readonly Recurso[];
  /** Incidente al que se asignan los recursos que se despachen. */
  readonly incidenteSeleccionadoId: string | null;
  readonly onCambiarEstado: (recurso: Recurso, estado: EstadoRecurso) => void;
}

const ESTADO_UI: Record<EstadoRecurso, EstadoRecursoUI> = {
  Disponible: 'disponible',
  Despachado: 'despachado',
  'En Escena': 'escena',
  Inoperativo: 'inoperativo',
};

const ETIQUETA_ACCION: Record<EstadoRecurso, string> = {
  Disponible: 'Liberar',
  Despachado: 'Despachar',
  'En Escena': 'En escena',
  Inoperativo: 'Inoperativo',
};

/** Solo Despachar es la acción primaria (naranja); el resto es secundaria o neutra. */
const VARIANTE_ACCION: Record<EstadoRecurso, VarianteBoton> = {
  Disponible: 'ghost',
  Despachado: 'primary',
  'En Escena': 'secondary',
  Inoperativo: 'ghost',
};

export function PanelRecursos({ recursos, incidenteSeleccionadoId, onCambiarEstado }: Props) {
  const libres = recursos.filter((r) => r.estado_actual === 'Disponible').length;
  return (
    <section aria-label="Recursos" className="max-h-72 shrink-0 overflow-y-auto">
      <SectionHeader index="03" title="Recursos operativos" count={`${recursos.length} · ${libres} libres`} />
      {ESTADOS_RECURSO.map((estado) => {
        const grupo = recursos.filter((r) => r.estado_actual === estado);
        return (
          <div key={estado} role="group" aria-label={estado}>
            <p className="px-4 py-1">
              <StatusIndicator status={ESTADO_UI[estado]} label={estado} count={grupo.length} />
            </p>
            <ul>
              {grupo.map((r) => (
                <li key={r.id}>
                  <DispatchRow
                    kind={r.tipo}
                    code={r.etiqueta ?? r.id}
                    status={ESTADO_UI[r.estado_actual]}
                    actions={TRANSICIONES_RECURSO[r.estado_actual].map((destino) => {
                      const sinIncidente = destino === 'Despachado' && !incidenteSeleccionadoId;
                      return (
                        <Button
                          key={destino}
                          size="sm"
                          variant={VARIANTE_ACCION[destino]}
                          disabled={sinIncidente}
                          title={sinIncidente ? 'Selecciona un incidente para despachar' : undefined}
                          aria-label={`${ETIQUETA_ACCION[destino]} ${r.id}`}
                          onClick={() => onCambiarEstado(r, destino)}
                        >
                          {ETIQUETA_ACCION[destino]}
                        </Button>
                      );
                    })}
                  />
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
