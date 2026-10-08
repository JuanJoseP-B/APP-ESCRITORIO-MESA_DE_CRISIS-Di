import { cx } from '../cx';
import { Button } from './Button';
import { Glyph, type FormaGlifo } from './Glyph';
import './ShelterGauge.css';

export interface ShelterGaugeProps {
  name: string;
  current: number;
  capacity: number;
  /** Personas que suman/restan los botones. */
  step?: number;
  onDecrement?: () => void;
  onIncrement?: () => void;
  /** Nombres accesibles de los botones (por defecto "Restar N" / "Sumar N"). */
  decrementLabel?: string;
  incrementLabel?: string;
  className?: string;
}

type Nivel = 'ok' | 'warning' | 'critical';

function nivelDe(pct: number): Nivel {
  if (pct >= 90) return 'critical';
  if (pct >= 70) return 'warning';
  return 'ok';
}

const FORMA_NIVEL: Record<Nivel, FormaGlifo> = { critical: 'square', warning: 'triangle', ok: 'circle' };

/** Aforo con ceros a la izquierda (045/200) y estado en glifo + palabra. */
export function ShelterGauge({ name, current, capacity, step = 5, onDecrement, onIncrement, decrementLabel, incrementLabel, className }: ShelterGaugeProps) {
  const cap = capacity > 0 ? capacity : 1;
  const cur = Math.max(0, Math.min(current, cap));
  const pct = Math.round((cur / cap) * 100);
  const nivel = nivelDe(pct);
  const etiqueta = pct >= 100 ? 'Lleno' : nivel === 'critical' ? 'Casi lleno' : nivel === 'warning' ? 'Alta ocupación' : 'Con cupo';
  const ancho = String(cap).length;
  return (
    <div className={cx('ag-gauge', nivel !== 'ok' && `ag-gauge--${nivel}`, className)}>
      <div className="ag-gauge__head">
        <span className="ag-gauge__name">{name}</span>
        <span className="ag-gauge__read">
          <span className="ag-gauge__value">{`${String(cur).padStart(ancho, '0')}/${cap}`}</span>
          <span className="ag-gauge__cap">{pct}%</span>
        </span>
      </div>
      <div className="ag-gauge__ctrl">
        <Button size="sm" square aria-label={decrementLabel ?? `Restar ${step}`} onClick={onDecrement} disabled={cur <= 0}>
          {`−${step}`}
        </Button>
        <Button size="sm" square aria-label={incrementLabel ?? `Sumar ${step}`} onClick={onIncrement} disabled={cur >= cap}>
          {`+${step}`}
        </Button>
      </div>
      <div className="ag-gauge__bar" role="meter" aria-valuemin={0} aria-valuemax={cap} aria-valuenow={cur} aria-label={`Aforo ${name}`}>
        <span className="ag-gauge__fill" style={{ width: `${pct}%` }} />
        <span className="ag-gauge__tick" style={{ left: '70%' }} />
        <span className="ag-gauge__tick" style={{ left: '90%' }} />
      </div>
      <div className="ag-gauge__state">
        <span className="ag-status">
          <Glyph shape={FORMA_NIVEL[nivel]} />
          {etiqueta}
        </span>
        <span>{cap - cur} cupos</span>
      </div>
    </div>
  );
}
