import type { Coordenadas, EstadoSla, Recurso } from '@argos/shared';
import { textoEstadoRecurso, textoEstadoRecursoCorto, textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { formatearDistancia } from '../domain/despacho';
import { distanciaM } from '../domain/geo';
import type { EtaUnidad } from '../domain/movimiento';
import { formatearMinSeg } from '../domain/reloj';
import { indicativosDe, ordenarUnidades, resumirUnidades } from '../domain/unidades';
import { datosCronometro, usePalabrasSla } from './CronometroUnidad';
import { ESTADO_RECURSO_UI } from './presentacion';
import { UnitCard } from './UnitCard';
import './TableroUnidades.css';

export interface TableroUnidadesProps {
  recursos: readonly Recurso[];
  /** Resalta las unidades asignadas a este incidente. */
  incidenteSeleccionadoId: string | null;
  /** Unidad elegida (aquí o en el mapa): se resalta igual en los dos sitios. */
  unidadSeleccionadaId?: string | null;
  /** Clic en una tarjeta: la app selecciona el incidente al que está asignada la unidad. */
  onSeleccionarUnidad: (recurso: Recurso) => void;
  /** SLA de las unidades con despacho en curso, por id de recurso; su tarjeta lleva el cronómetro. */
  sla?: ReadonlyMap<string, EstadoSla>;
  /** Menos movimiento: sin animaciones; el cronómetro vencido no parpadea y se marca con rayas. */
  reducirMovimiento?: boolean;
  /** Lugar del incidente seleccionado: las unidades libres muestran a qué distancia están. */
  destino?: Coordenadas | null;
  /** Avance y tiempo restante de las unidades en ruta, por id de recurso. */
  etas?: ReadonlyMap<string, EtaUnidad>;
  /** Cursor o foco sobre una tarjeta: el mapa resalta la unidad; `null` al salir. */
  onResaltarUnidad?: (id: string | null) => void;
}

const SIN_SLA: ReadonlyMap<string, EstadoSla> = new Map();
const SIN_ETAS: ReadonlyMap<string, EtaUnidad> = new Map();

/** E · tablero de unidades: resumen de disponibles y una tarjeta por unidad; solo desplaza en horizontal si no caben. */
export function TableroUnidades({
  recursos,
  incidenteSeleccionadoId,
  unidadSeleccionadaId = null,
  onSeleccionarUnidad,
  sla = SIN_SLA,
  reducirMovimiento = false,
  destino = null,
  etas = SIN_ETAS,
  onResaltarUnidad,
}: TableroUnidadesProps) {
  const { t, idioma } = useTexto();
  const palabras = usePalabrasSla();
  const indicativos = indicativosDe(recursos);
  const { total, disponibles } = resumirUnidades(recursos);

  /** Lo que acompaña al estado en el chip: ETA si va en ruta, distancia al incidente si está libre. */
  const detalleDe = (r: Recurso): string | null => {
    const eta = etas.get(r.id);
    if (r.estado_actual === 'EN_RUTA' && eta) return formatearMinSeg(eta.restanteSeg);
    const posicion = r.ubicacion ?? r.base ?? null;
    if (r.estado_actual === 'DISPONIBLE' && destino && posicion) return formatearDistancia(distanciaM(posicion, destino), idioma);
    return null;
  };

  return (
    <div className="ag-tablero">
      <p className="ag-tablero__resumen m-0" aria-label={t('tablero.resumen.aria', { disponibles, total })}>
        <span className="ag-tablero__titulo">{t('tablero.titulo')}</span>
        <span className="ag-tablero__conteo" aria-hidden="true">
          {disponibles}
          <span className="ag-tablero__total">/{total}</span>
        </span>
        <span className="ag-tablero__pie" aria-hidden="true">
          {t('tablero.disponibles')}
        </span>
      </p>
      {total === 0 ? (
        <p className="ag-tablero__vacio">{t('tablero.vacio')}</p>
      ) : (
        <ul className="ag-tablero__chips ag-scroll-fino" aria-label={t('tablero.titulo')}>
          {ordenarUnidades(recursos).map((r) => {
            const cronometro = datosCronometro(sla.get(r.id));
            const eta = r.estado_actual === 'EN_RUTA' ? etas.get(r.id) : undefined;
            return (
              <li key={r.id}>
                <UnitCard
                  callsign={indicativos.get(r.id) ?? r.id}
                  tipo={r.tipo}
                  kind={textoTipoRecurso(t, r.tipo)}
                  status={ESTADO_RECURSO_UI[r.estado_actual]}
                  statusLabel={textoEstadoRecurso(t, r.estado_actual)}
                  statusShort={textoEstadoRecursoCorto(t, r.estado_actual)}
                  detalle={detalleDe(r)}
                  progreso={eta?.progreso ?? null}
                  timer={cronometro?.tiempo}
                  timerLevel={cronometro?.nivel}
                  timerWords={palabras}
                  reduceMotion={reducirMovimiento}
                  selected={r.id === unidadSeleccionadaId || (incidenteSeleccionadoId !== null && r.incidente_asignado_id === incidenteSeleccionadoId)}
                  focused={r.id === unidadSeleccionadaId}
                  onSelect={() => onSeleccionarUnidad(r)}
                  onResaltar={onResaltarUnidad ? (activo) => onResaltarUnidad(activo ? r.id : null) : undefined}
                />
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
