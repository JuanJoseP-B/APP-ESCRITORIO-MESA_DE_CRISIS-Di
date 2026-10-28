import { useEffect, useRef, useState } from 'react';
import type { TipoRecurso } from '@argos/shared';
import { CronometroSla, ESTADOS_RECURSO_UI, Glyph, type EstadoRecursoUI, type NivelCronometro, type PalabrasCronometro } from '@argos/ui';

/** Clase visual de cada tipo de unidad: color del icono y animación propia. */
const CLASE_TIPO: Readonly<Record<TipoRecurso, 'fuego' | 'salud' | 'policia'>> = {
  Bomberos: 'fuego',
  Ambulancia: 'salud',
  Policía: 'policia',
};

/** Cuánto dura la animación del tipo al despachar la unidad. */
export const ANIMACION_DESPACHO_MS = 1200;
/** Ventana del giro del chip al cambiar de estado (la animación dura 300 ms). */
const GIRO_CHIP_MS = 400;

export interface UnitCardProps {
  readonly callsign: string;
  readonly tipo: TipoRecurso;
  /** Tipo en palabras, para lectores de pantalla. */
  readonly kind: string;
  readonly status: EstadoRecursoUI;
  readonly statusLabel: string;
  readonly statusShort: string;
  /** Detalle que sigue al estado en el chip: distancia al incidente («0,9 km») o ETA («02:40»). */
  readonly detalle?: string | null;
  /** Avance hacia el incidente (0–1) de una unidad en ruta: barra de ETA en el borde inferior. */
  readonly progreso?: number | null;
  readonly timer?: string;
  readonly timerLevel?: NivelCronometro;
  readonly timerWords: PalabrasCronometro;
  readonly reduceMotion?: boolean;
  readonly selected?: boolean;
  readonly focused?: boolean;
  readonly onSelect: () => void;
  /** Pasar el cursor o el foco: resalta la unidad en el mapa; `false` al salir. */
  readonly onResaltar?: (activo: boolean) => void;
}

function IconoTipo({ tipo }: { readonly tipo: TipoRecurso }) {
  if (tipo === 'Bomberos') {
    return (
      <svg className="ag-unidad__llama" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2.5 1.5-4 2.5-5 .2 1.8 1 3 2 3.2C11 9 11.5 5.5 12 2z" />
      </svg>
    );
  }
  if (tipo === 'Ambulancia') {
    return (
      <svg className="ag-unidad__cruz" width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z" />
      </svg>
    );
  }
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2 4 5v6c0 5 3.4 9.3 8 11 4.6-1.7 8-6 8-11V5z" />
    </svg>
  );
}

/**
 * Tarjeta de unidad del tablero. Cada tipo tiene su microanimación, solo al pasar el cursor y al despacharla (nunca
 * en reposo): la llama de Bomberos titila y suelta chispas, la cruz de la Ambulancia late sobre un electrocardiograma
 * y la Policía alterna luces rojo/azul con una franja de sirena. En ruta lleva borde naranja y barra de ETA.
 */
export function UnitCard({
  callsign,
  tipo,
  kind,
  status,
  statusLabel,
  statusShort,
  detalle,
  progreso,
  timer,
  timerLevel = 'en_tiempo',
  timerWords,
  reduceMotion = false,
  selected = false,
  focused = false,
  onSelect,
  onResaltar,
}: UnitCardProps) {
  const estado = ESTADOS_RECURSO_UI[status];
  const palabraNivel = timerLevel === 'en_tiempo' ? undefined : timerWords[timerLevel];
  const nombre = [callsign, kind, statusLabel, timer ? `${timer}${palabraNivel ? `, ${palabraNivel}` : ''}` : null].filter(Boolean).join(', ');

  // Al cambiar de estado el chip gira; si la unidad acaba de salir (despachada o en ruta), su icono se anima un momento.
  const previo = useRef(status);
  const [girando, setGirando] = useState(false);
  const [despachando, setDespachando] = useState(false);
  useEffect(() => {
    if (previo.current === status) return;
    previo.current = status;
    if (reduceMotion) return;
    setGirando(true);
    const salida = status === 'despachado' || status === 'enruta';
    if (salida) setDespachando(true);
    const giro = setTimeout(() => setGirando(false), GIRO_CHIP_MS);
    const despacho = salida ? setTimeout(() => setDespachando(false), ANIMACION_DESPACHO_MS) : null;
    return () => {
      clearTimeout(giro);
      if (despacho) clearTimeout(despacho);
    };
  }, [status, reduceMotion]);

  const clase = CLASE_TIPO[tipo];
  return (
    <button
      type="button"
      className={`ag-unidad ag-unidad--${clase}`}
      data-estado={status}
      data-animando={despachando || undefined}
      data-foco={focused || undefined}
      aria-pressed={selected ? 'true' : 'false'}
      aria-label={nombre}
      onClick={onSelect}
      onMouseEnter={() => onResaltar?.(true)}
      onMouseLeave={() => onResaltar?.(false)}
      onFocus={() => onResaltar?.(true)}
      onBlur={() => onResaltar?.(false)}
    >
      {clase === 'policia' && <span aria-hidden="true" className="ag-unidad__sirena" />}
      <span className="ag-unidad__icono" aria-hidden="true">
        {clase === 'fuego' && (
          <>
            <span className="ag-unidad__chispa" />
            <span className="ag-unidad__chispa ag-unidad__chispa--2" />
          </>
        )}
        <IconoTipo tipo={tipo} />
      </span>
      <span className="ag-unidad__datos">
        <span className="ag-unidad__fila">
          <span className="ag-unidad__codigo">{callsign}</span>
          {timer ? <CronometroSla className="ag-unidad__timer" nivel={timerLevel} tiempo={timer} palabras={timerWords} reducirMovimiento={reduceMotion} /> : null}
        </span>
        <span className="ag-unidad__chip" data-cambio={girando || undefined}>
          <Glyph shape={estado.shape} />
          <span className="ag-unidad__palabra">{statusShort}</span>
          {detalle ? <span className="ag-unidad__detalle">{status === 'enruta' ? detalle : `· ${detalle}`}</span> : null}
        </span>
      </span>
      {clase === 'salud' && (
        <svg className="ag-unidad__ecg" viewBox="0 0 160 20" preserveAspectRatio="none" aria-hidden="true">
          <path pathLength={1} d="M0 12 H50 L58 12 L64 2 L70 18 L76 8 L80 12 H160" fill="none" stroke="currentColor" strokeWidth={1.5} />
        </svg>
      )}
      {progreso != null && <span aria-hidden="true" className="ag-unidad__eta" style={{ width: `${Math.round(Math.min(1, Math.max(0, progreso)) * 100)}%` }} />}
    </button>
  );
}
