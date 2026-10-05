import type { ReactNode } from 'react';
import { ETIQUETAS_TIPO_EMERGENCIA, TIPOS_EMERGENCIA, type TipoEmergencia } from '@argos/shared';

const TRAZO = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'square',
  strokeLinejoin: 'miter',
} as const;

const ICONOS: Readonly<Record<TipoEmergencia, ReactNode>> = {
  INCENDIO: <path d="M12 3c1 4 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9Z" />,
  CRECIENTE_SUBITA: (
    <>
      <path d="M3 17c3-2 6 2 9 0s6 2 9 0" />
      <path d="M12 14V4M8 8l4-4 4 4" />
    </>
  ),
  DESLIZAMIENTO: (
    <>
      <path d="M3 19 10 6l4 6 3-4 4 11H3Z" />
      <path d="M13 15l2 2M10 16l1 1" />
    </>
  ),
  VIA_BLOQUEADA: (
    <>
      <path d="M5 21 8 3M19 21 16 3" />
      <path d="M6 8h12M5.5 14h13" />
    </>
  ),
  FUGA_GAS: (
    <>
      <path d="M8 21V10h8v11H8ZM10 10V7h4v3" />
      <path d="M18 5c2 1 2 3 0 4M20 3c3 2 3 6 0 8" />
    </>
  ),
  INUNDACION: (
    <>
      <path d="M4 11 12 4l8 7M6 10v4M18 10v4" />
      <path d="M3 18c3-2 6 2 9 0s6 2 9 0" />
    </>
  ),
};

interface Props {
  readonly valor: TipoEmergencia | null;
  readonly onCambiar: (tipo: TipoEmergencia) => void;
}

/** Cuadrícula de 2 columnas con botones táctiles de al menos 80 px; sustituye al `<select>`. */
export function SelectorTipoEmergencia({ valor, onCambiar }: Props) {
  return (
    <div role="radiogroup" aria-label="Tipo de emergencia" className="grid grid-cols-2 gap-2">
      {TIPOS_EMERGENCIA.map((tipo) => {
        const activo = valor === tipo;
        return (
          <button
            key={tipo}
            type="button"
            role="radio"
            aria-checked={activo}
            onClick={() => onCambiar(tipo)}
            className={`flex min-h-20 flex-col items-start justify-between border-2 p-2 text-left ${
              activo ? 'border-critico bg-critico text-white' : 'border-linea bg-superficie text-texto'
            }`}
          >
            <svg viewBox="0 0 24 24" width="28" height="28" aria-hidden="true" {...TRAZO}>
              {ICONOS[tipo]}
            </svg>
            <span className="font-mono text-xs font-bold uppercase tracking-wide">
              {ETIQUETAS_TIPO_EMERGENCIA[tipo]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
