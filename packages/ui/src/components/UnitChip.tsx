import { cx } from '../cx';
import { ESTADOS_RECURSO_UI, type EstadoRecursoUI } from './StatusIndicator';
import { Glyph } from './Glyph';
import './UnitChip.css';

/** Palabra corta del estado: cabe en el chip de ancho fijo sin truncar el indicativo. */
export const ABREVIATURA_ESTADO_UNIDAD: Record<EstadoRecursoUI, string> = {
  disponible: 'DISP',
  despachado: 'ASIG',
  escena: 'ESC',
  inoperativo: 'INOP',
};

/** Nivel del cronómetro; `en_tiempo` es neutro, los otros añaden glifo y palabra. */
export type NivelCronometro = 'en_tiempo' | 'alerta' | 'vencido';

const NIVELES_CRONOMETRO = {
  alerta: { palabra: 'alerta', shape: 'triangle' },
  vencido: { palabra: 'vencido', shape: 'square' },
} as const;

export interface UnitChipProps {
  /** Indicativo completo, p. ej. "M-01"; nunca se trunca. */
  callsign: string;
  status: EstadoRecursoUI;
  /** Tipo de unidad para lectores de pantalla, p. ej. "Ambulancia". */
  kind?: string;
  /** Cronómetro "mm:ss" del hito vigente; se omite si no aplica. */
  timer?: string;
  timerLevel?: NivelCronometro;
  selected?: boolean;
  /** Con `onSelect` el chip es un botón; sin él, un elemento informativo. */
  onSelect?: () => void;
  className?: string;
}

export function UnitChip({ callsign, status, kind, timer, timerLevel = 'en_tiempo', selected, onSelect, className }: UnitChipProps) {
  const estado = ESTADOS_RECURSO_UI[status];
  const nivel = timerLevel === 'en_tiempo' ? undefined : NIVELES_CRONOMETRO[timerLevel];
  const nombre = [callsign, kind, estado.label, timer ? `${timer}${nivel ? `, ${nivel.palabra}` : ''}` : null]
    .filter(Boolean)
    .join(', ');
  const contenido = (
    <>
      <span className="ag-unit__callsign">{callsign}</span>
      <span className="ag-unit__state">
        <Glyph shape={estado.shape} />
        {ABREVIATURA_ESTADO_UNIDAD[status]}
      </span>
      {timer ? (
        <span className="ag-unit__timer" data-nivel={timerLevel}>
          {nivel ? <Glyph shape={nivel.shape} /> : null}
          {timer}
        </span>
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
