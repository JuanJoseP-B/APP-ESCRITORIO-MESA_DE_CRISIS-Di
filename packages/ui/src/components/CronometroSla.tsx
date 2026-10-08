import { useEffect, useState } from 'react';
import { cx } from '../cx';
import { Glyph, type FormaGlifo } from './Glyph';
import './CronometroSla.css';

/** Nivel del cronómetro SLA; `en_tiempo` es neutro, los otros añaden glifo y palabra. */
export type NivelCronometro = 'en_tiempo' | 'alerta' | 'vencido';

export const GLIFO_NIVEL_CRONOMETRO: Readonly<Record<Exclude<NivelCronometro, 'en_tiempo'>, FormaGlifo>> = {
  alerta: 'triangle',
  vencido: 'square',
};

export interface PalabrasCronometro {
  readonly alerta: string;
  readonly vencido: string;
}

/** Palabras por defecto (español); la app las sustituye por las de su idioma. */
export const PALABRAS_CRONOMETRO: PalabrasCronometro = { alerta: 'alerta', vencido: 'vencido' };

const CONSULTA_MOVIMIENTO_REDUCIDO = '(prefers-reduced-motion: reduce)';

/** `true` si el sistema pide menos movimiento; se actualiza si el operador lo cambia con la consola abierta. */
function useSistemaReduceMovimiento(): boolean {
  const consulta = (): MediaQueryList | null =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_MOVIMIENTO_REDUCIDO) : null;
  const [reduce, setReduce] = useState(() => consulta()?.matches ?? false);
  useEffect(() => {
    const mq = consulta();
    if (!mq) return;
    const alCambiar = () => setReduce(mq.matches);
    alCambiar();
    mq.addEventListener('change', alCambiar);
    return () => mq.removeEventListener('change', alCambiar);
  }, []);
  return reduce;
}

export interface CronometroSlaProps {
  nivel: NivelCronometro;
  /** Tiempo transcurrido del hito, ya formateado como "mm:ss". */
  tiempo: string;
  /** Palabra de cada nivel (lectores de pantalla y texto visible); por defecto, en español. */
  palabras?: PalabrasCronometro;
  /** Muestra la palabra del nivel junto al tiempo. Con `false` solo la leen los lectores de pantalla. */
  mostrarPalabra?: boolean;
  /** La palabra va en una segunda línea (chips estrechos). */
  apilado?: boolean;
  /**
   * El operador pidió menos movimiento (Ajustes). También se respeta `prefers-reduced-motion` del sistema:
   * VENCIDO deja de parpadear y se marca con un borde grueso y rayas.
   */
  reducirMovimiento?: boolean;
  className?: string;
}

/**
 * Cronómetro SLA de una unidad: "mm:ss" más el nivel con forma, palabra y color (nunca solo color). VENCIDO parpadea
 * a 1 Hz; con menos movimiento se cambia por un borde grueso con patrón de rayas.
 */
export function CronometroSla({ nivel, tiempo, palabras = PALABRAS_CRONOMETRO, mostrarPalabra = true, apilado = false, reducirMovimiento = false, className }: CronometroSlaProps) {
  const sistemaReduce = useSistemaReduceMovimiento();
  const reducido = reducirMovimiento || sistemaReduce;
  const palabra = nivel === 'en_tiempo' ? null : palabras[nivel];
  return (
    <span
      role="timer"
      aria-label={palabra ? `${tiempo}, ${palabra}` : tiempo}
      className={cx('ag-sla', apilado && 'ag-sla--apilado', className)}
      data-nivel={nivel}
      data-movimiento={reducido ? 'reducido' : 'normal'}
    >
      {nivel === 'en_tiempo' ? null : <Glyph shape={GLIFO_NIVEL_CRONOMETRO[nivel]} />}
      <span className="ag-sla__tiempo">{tiempo}</span>
      {palabra && mostrarPalabra ? <span className="ag-sla__palabra">{palabra}</span> : null}
    </span>
  );
}
