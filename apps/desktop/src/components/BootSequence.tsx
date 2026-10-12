import { useCallback, useEffect, useRef, useState } from 'react';
import { Glyph, movimientoReducido } from '@argos/ui';
import {
  DURACION_ARRANQUE_ESTATICA_MS,
  DURACION_ARRANQUE_MS,
  TICS_ARRANQUE,
  TIC_ARRANQUE_MS,
  faseLinea,
  lineasArranque,
  type LineaArranque,
  type SubsistemasArranque,
} from '../domain/arranque';
import { useCapaEscape } from '../hooks/useCapaEscape';
import { useTexto } from '../i18n/IdiomaProvider';

export interface BootSequenceProps {
  /** Estado real de cada subsistema; puede cambiar mientras la secuencia corre y la línea lo refleja. */
  readonly subsistemas: SubsistemasArranque;
  readonly reducirMovimiento?: boolean;
  /** Se llama una sola vez: al terminar la secuencia o al saltarla (Esc, Enter o clic). */
  readonly onCompletar: () => void;
}

function Resultado({ linea }: { readonly linea: LineaArranque }) {
  const { t } = useTexto();
  const texto = t(linea.detalle, linea.params);
  if (linea.resultado === 'ERROR') {
    return (
      <span className="flex items-center gap-2 text-status-critical">
        <Glyph shape="square" /> {texto}
      </span>
    );
  }
  if (linea.resultado === 'PENDIENTE') {
    return (
      <span className="flex items-center gap-2 text-status-info">
        <Glyph shape="diamond" /> {texto}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-2 text-status-success">
      <span aria-hidden="true">✓</span> {texto}
    </span>
  );
}

/**
 * Pantalla de arranque tras el login: una línea por subsistema con su resultado real. No bloquea nada: es un
 * telón sobre la consola ya montada, y se salta con Esc, Enter o clic. Con movimiento reducido sale completa y estática.
 */
export function BootSequence({ subsistemas, reducirMovimiento = false, onCompletar }: BootSequenceProps) {
  const { t } = useTexto();
  const [estatica] = useState(() => reducirMovimiento || movimientoReducido());
  const [tic, setTic] = useState(estatica ? TICS_ARRANQUE : 0);
  const raiz = useRef<HTMLDivElement>(null);
  const alCompletar = useRef(onCompletar);
  alCompletar.current = onCompletar;
  const hecho = useRef(false);
  const completar = useCallback(() => {
    if (hecho.current) return;
    hecho.current = true;
    alCompletar.current();
  }, []);

  useCapaEscape(completar);
  useEffect(() => {
    raiz.current?.focus();
    // En captura: Enter no debe activar el control de la consola que tuviera el foco.
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      e.stopPropagation();
      completar();
    };
    document.addEventListener('keydown', alPulsar, true);
    return () => document.removeEventListener('keydown', alPulsar, true);
  }, [completar]);

  useEffect(() => {
    const fin = setTimeout(completar, estatica ? DURACION_ARRANQUE_ESTATICA_MS : DURACION_ARRANQUE_MS);
    if (estatica) return () => clearTimeout(fin);
    const reloj = setInterval(() => setTic((n) => Math.min(n + 1, TICS_ARRANQUE)), TIC_ARRANQUE_MS);
    return () => {
      clearTimeout(fin);
      clearInterval(reloj);
    };
  }, [estatica, completar]);

  return (
    <div
      ref={raiz}
      role="dialog"
      aria-modal="true"
      aria-label={t('arranque.titulo')}
      tabIndex={-1}
      onClick={completar}
      className="fixed inset-0 z-modal flex items-center justify-center bg-surface-canvas p-6 outline-none"
    >
      <div className="w-full max-w-lg border border-border-strong bg-surface-panel p-6 shadow-overlay">
        <h1 className="border-b border-border-strong pb-3 font-mono text-overline uppercase text-text-primary">
          <span aria-hidden="true">■ </span>
          {t('arranque.titulo')}
        </h1>
        <ol aria-live="polite" className="mt-4 flex flex-col gap-2 font-mono text-data-sm">
          {lineasArranque(subsistemas).map((linea, n) => {
            const fase = faseLinea(n, tic);
            return (
              <li
                key={linea.id}
                data-fase={fase}
                aria-hidden={fase === 'oculta' || undefined}
                className={`flex min-h-row items-center justify-between gap-4 ${fase === 'oculta' ? 'invisible' : 'ag-arranque-linea'}`}
              >
                <span className="text-text-primary">{t(`arranque.${linea.id}`)}</span>
                {fase === 'resuelta' ? (
                  <Resultado linea={linea} />
                ) : (
                  <span className="text-text-muted">{t('arranque.comprobando')}</span>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-4 border-t border-border-subtle pt-3 font-mono text-overline uppercase text-text-muted">{t('arranque.saltar')}</p>
      </div>
    </div>
  );
}
