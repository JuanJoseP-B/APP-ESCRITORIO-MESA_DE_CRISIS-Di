import { useRef, type KeyboardEvent } from 'react';
import { cx } from '../cx';
import { Glyph } from './Glyph';
import './SegmentedControl.css';

export interface OpcionSegmento<V extends string = string> {
  readonly value: V;
  readonly label: string;
}

export interface SegmentedControlProps<V extends string = string> {
  /** Nombre accesible del grupo. */
  label: string;
  options: readonly OpcionSegmento<V>[];
  value: V;
  onChange: (value: V) => void;
  className?: string;
}

/** Elige una sola opción entre pocas: grupo de radio con teclado en flechas. La elegida lleva glifo y color. */
export function SegmentedControl<V extends string>({ label, options, value, onChange, className }: SegmentedControlProps<V>) {
  const grupo = useRef<HTMLDivElement>(null);

  const alPulsar = (e: KeyboardEvent<HTMLButtonElement>, indice: number) => {
    const paso = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (paso === 0) return;
    e.preventDefault();
    const destino = options[(indice + paso + options.length) % options.length];
    if (!destino) return;
    onChange(destino.value);
    grupo.current?.querySelectorAll<HTMLElement>('[role="radio"]')[options.indexOf(destino)]?.focus();
  };

  return (
    <div ref={grupo} role="radiogroup" aria-label={label} className={cx('ag-seg', className)}>
      {options.map((o, i) => {
        const elegida = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={elegida}
            tabIndex={elegida ? 0 : -1}
            className="ag-seg__opt"
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => alPulsar(e, i)}
          >
            {elegida ? <Glyph shape="circle" /> : <Glyph shape="ring" />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
