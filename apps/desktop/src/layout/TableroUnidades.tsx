import type { EstadoSla, Recurso } from '@argos/shared';
import { UnitChip } from '@argos/ui';
import { textoEstadoRecurso, textoEstadoRecursoCorto, textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { indicativosDe, ordenarUnidades, resumirUnidades } from '../domain/unidades';
import { datosCronometro, usePalabrasSla } from './CronometroUnidad';
import { ESTADO_RECURSO_UI } from './presentacion';
import './TableroUnidades.css';

export interface TableroUnidadesProps {
  recursos: readonly Recurso[];
  /** Resalta las unidades asignadas a este incidente. */
  incidenteSeleccionadoId: string | null;
  /** Unidad elegida (aquí o en el mapa): se resalta igual en los dos sitios. */
  unidadSeleccionadaId?: string | null;
  /** Clic en un chip: la app selecciona el incidente al que está asignada la unidad. */
  onSeleccionarUnidad: (recurso: Recurso) => void;
  /** SLA de las unidades con despacho en curso, por id de recurso; su chip lleva el cronómetro. */
  sla?: ReadonlyMap<string, EstadoSla>;
  /** Menos movimiento: el cronómetro vencido no parpadea y se marca con rayas. */
  reducirMovimiento?: boolean;
}

const SIN_SLA: ReadonlyMap<string, EstadoSla> = new Map();

/** E · tablero de unidades: un chip de ancho fijo por unidad; solo desplaza en horizontal si no caben. */
export function TableroUnidades({ recursos, incidenteSeleccionadoId, unidadSeleccionadaId = null, onSeleccionarUnidad, sla = SIN_SLA, reducirMovimiento = false }: TableroUnidadesProps) {
  const { t } = useTexto();
  const palabras = usePalabrasSla();
  const indicativos = indicativosDe(recursos);
  const { total, disponibles } = resumirUnidades(recursos);
  return (
    <div className="ag-tablero">
      <div className="ag-tablero__resumen">
        <span className="ag-tablero__titulo">{t('tablero.titulo')}</span>
        <span className="ag-tablero__conteo">
          {t('tablero.conteo', { disponibles, total })}
        </span>
      </div>
      {total === 0 ? (
        <p className="ag-tablero__vacio">{t('tablero.vacio')}</p>
      ) : (
        <ul className="ag-tablero__chips" aria-label={t('tablero.titulo')}>
          {ordenarUnidades(recursos).map((r) => {
            const cronometro = datosCronometro(sla.get(r.id));
            return (
              <li key={r.id}>
                <UnitChip
                  callsign={indicativos.get(r.id) ?? r.id}
                  kind={textoTipoRecurso(t, r.tipo)}
                  status={ESTADO_RECURSO_UI[r.estado_actual]}
                  statusLabel={textoEstadoRecurso(t, r.estado_actual)}
                  statusShort={textoEstadoRecursoCorto(t, r.estado_actual)}
                  timer={cronometro?.tiempo}
                  timerLevel={cronometro?.nivel}
                  timerWords={palabras}
                  reduceMotion={reducirMovimiento}
                  selected={r.id === unidadSeleccionadaId || (incidenteSeleccionadoId !== null && r.incidente_asignado_id === incidenteSeleccionadoId)}
                  className={r.id === unidadSeleccionadaId ? 'ag-unit--foco' : undefined}
                  onSelect={() => onSeleccionarUnidad(r)}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
