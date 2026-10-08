import { cx } from '../cx';
import { ESTADOS_RECURSO_UI, type EstadoRecursoUI } from './StatusIndicator';
import { Glyph } from './Glyph';
import { CronometroSla, PALABRAS_CRONOMETRO, type NivelCronometro, type PalabrasCronometro } from './CronometroSla';
import './UnitChip.css';

/** Palabra corta del estado: cabe en el chip de ancho fijo sin truncar el indicativo. */
export const ABREVIATURA_ESTADO_UNIDAD: Record<EstadoRecursoUI, string> = {
  disponible: 'DISP',
  despachado: 'ASIG',
  enruta: 'RUTA',
  escena: 'ESC',
  inoperativo: 'INOP',
};

export interface UnitChipProps {
  /** Indicativo completo, p. ej. "M-01"; nunca se trunca. */
  callsign: string;
  status: EstadoRecursoUI;
  /** Tipo de unidad para lectores de pantalla, p. ej. "Ambulancia". */
  kind?: string;
  /** Palabra completa del estado (lectores de pantalla) y su abreviatura; por defecto, en español. */
  statusLabel?: string;
  statusShort?: string;
  /** Cronómetro "mm:ss" del hito vigente; se omite si no aplica. */
  timer?: string;
  timerLevel?: NivelCronometro;
  /** Palabras de los niveles del cronómetro; por defecto, en español. */
  timerWords?: PalabrasCronometro;
  /** Menos movimiento: el cronómetro vencido no parpadea y se marca con rayas. */
  reduceMotion?: boolean;
  selected?: boolean;
  /** Con `onSelect` el chip es un botón; sin él, un elemento informativo. */
  onSelect?: () => void;
  className?: string;
}

export function UnitChip({ callsign, status, kind, statusLabel, statusShort, timer, timerLevel = 'en_tiempo', timerWords = PALABRAS_CRONOMETRO, reduceMotion = false, selected, onSelect, className }: UnitChipProps) {
  const estado = ESTADOS_RECURSO_UI[status];
  const palabraNivel = timerLevel === 'en_tiempo' ? undefined : timerWords[timerLevel];
  const nombre = [callsign, kind, statusLabel ?? estado.label, timer ? `${timer}${palabraNivel ? `, ${palabraNivel}` : ''}` : null]
    .filter(Boolean)
    .join(', ');
  const contenido = (
    <>
      <span className="ag-unit__callsign">{callsign}</span>
      <span className="ag-unit__state">
        <Glyph shape={estado.shape} />
        {statusShort ?? ABREVIATURA_ESTADO_UNIDAD[status]}
      </span>
      {timer ? (
        <CronometroSla className="ag-unit__timer" nivel={timerLevel} tiempo={timer} palabras={timerWords} reducirMovimiento={reduceMotion} apilado />
      ) : null}
    </>
  );
  const clases = cx('ag-unit', `ag-unit--${status}`, className);
  return onSelect ? (
    <button type="button" className={clases} aria-pressed={selected ? 'true' : 'false'} aria-label={nombre} onClick={onSelect}>
      {contenido}
    </button>
  ) : (
    <div role="group" className={clases} aria-label={nombre} data-selected={selected ? 'true' : undefined}>
      {contenido}
    </div>
  );
}
