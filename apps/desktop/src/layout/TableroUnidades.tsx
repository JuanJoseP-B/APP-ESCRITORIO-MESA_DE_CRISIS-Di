import type { Recurso } from '@argos/shared';
import { UnitChip } from '@argos/ui';
import { indicativosDe, ordenarUnidades, resumirUnidades } from '../domain/unidades';
import { ESTADO_RECURSO_UI } from './presentacion';
import './TableroUnidades.css';

export interface TableroUnidadesProps {
  recursos: readonly Recurso[];
  /** Resalta las unidades asignadas a este incidente. */
  incidenteSeleccionadoId: string | null;
  /** Clic en un chip: la app selecciona el incidente al que está asignada la unidad. */
  onSeleccionarUnidad: (recurso: Recurso) => void;
}

/** E · tablero de unidades: un chip de ancho fijo por unidad; solo desplaza en horizontal si no caben. */
export function TableroUnidades({ recursos, incidenteSeleccionadoId, onSeleccionarUnidad }: TableroUnidadesProps) {
  const indicativos = indicativosDe(recursos);
  const { total, disponibles } = resumirUnidades(recursos);
  return (
    <div className="ag-tablero">
      <div className="ag-tablero__resumen">
        <span className="ag-tablero__titulo">Unidades</span>
        <span className="ag-tablero__conteo">
          {disponibles}/{total} disp.
        </span>
      </div>
      {total === 0 ? (
        <p className="ag-tablero__vacio">Sin unidades registradas</p>
      ) : (
        <ul className="ag-tablero__chips" aria-label="Unidades">
          {ordenarUnidades(recursos).map((r) => (
            <li key={r.id}>
              <UnitChip
                callsign={indicativos.get(r.id) ?? r.id}
                kind={r.tipo}
                status={ESTADO_RECURSO_UI[r.estado_actual]}
                selected={incidenteSeleccionadoId !== null && r.incidente_asignado_id === incidenteSeleccionadoId}
                onSelect={() => onSeleccionarUnidad(r)}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
