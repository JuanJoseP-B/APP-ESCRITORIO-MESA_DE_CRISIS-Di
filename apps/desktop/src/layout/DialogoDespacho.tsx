import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { Incidente, Recurso } from '@argos/shared';
import { Button, Glyph, Kbd, SectionHeader } from '@argos/ui';
import { codigoIncidente } from '../domain/cola';
import { candidatasDeDespacho, formatearDistancia } from '../domain/despacho';
import { useAtajos } from '../hooks/useAtajos';
import { textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';

export interface DialogoDespachoProps {
  readonly incidente: Incidente;
  readonly recursos: readonly Recurso[];
  /** Despacha la unidad elegida al incidente. */
  readonly onConfirmar: (recurso: Recurso) => void;
  readonly onCancelar: () => void;
}

/**
 * Despacho con el teclado (atajo D): lista las unidades libres de la más cercana a la más lejana con la sugerida ya
 * elegida; las flechas cambian la elección, Enter despacha y Esc cancela. No es modal: el mapa y la cola siguen a la
 * vista, pero el foco entra en la lista y, al cerrar, vuelve a donde estaba.
 */
export function DialogoDespacho({ incidente, recursos, onConfirmar, onCancelar }: DialogoDespachoProps) {
  const { t, idioma } = useTexto();
  const candidatas = candidatasDeDespacho(recursos, incidente);
  const [elegidaId, setElegidaId] = useState<string | null>(candidatas[0]?.recurso.id ?? null);
  const raiz = useRef<HTMLElement>(null);
  const elegida = candidatas.find((c) => c.recurso.id === elegidaId) ?? candidatas[0] ?? null;

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    raiz.current?.querySelector<HTMLElement>('input[type="radio"]:checked, [data-foco-inicial]')?.focus();
    return () => {
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  useAtajos({ Escape: onCancelar });

  // Enter en la lista despacha; sobre un botón conserva su propia acción (Cancelar, Despachar).
  const alPulsar = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement || elegida === null) return;
    e.preventDefault();
    onConfirmar(elegida.recurso);
  };

  return (
    <section
      ref={raiz}
      role="dialog"
      aria-modal="false"
      aria-label={t('despacho.titulo', { codigo: codigoIncidente(incidente.id) })}
      onKeyDown={alPulsar}
      className="flex h-full min-h-0 flex-col border-l border-border-strong bg-surface-panel shadow-overlay"
    >
      <SectionHeader title={t('despacho.titulo', { codigo: codigoIncidente(incidente.id) })} count={candidatas.length} />
      <p className="px-4 pb-2 font-ui text-body-sm text-text-secondary">{incidente.titulo}</p>

      {candidatas.length === 0 ? (
        <p data-foco-inicial tabIndex={-1} className="px-4 py-3 font-mono text-data-sm text-text-muted">
          {t('despacho.sinUnidades')}
        </p>
      ) : (
        <fieldset className="min-h-0 flex-1 overflow-y-auto border-0 p-0">
          <legend className="px-4 pb-1 font-mono text-overline uppercase text-text-muted">{t('despacho.unidades')}</legend>
          <ul>
            {candidatas.map((c, n) => {
              const marcada = c.recurso.id === elegida?.recurso.id;
              return (
                <li key={c.recurso.id}>
                  <label
                    className={`flex min-h-row cursor-pointer items-center gap-3 border-b border-border-subtle px-4 py-2 hover:bg-surface-hover focus-within:shadow-focus ${marcada ? 'bg-surface-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="unidad-despacho"
                      value={c.recurso.id}
                      checked={marcada}
                      onChange={() => setElegidaId(c.recurso.id)}
                      className="sr-only"
                    />
                    <Glyph shape={marcada ? 'circle' : 'ring'} />
                    <span className="font-mono text-data-md font-bold tabular text-text-primary">{c.indicativo}</span>
                    <span className="font-ui text-body-sm text-text-secondary">{textoTipoRecurso(t, c.recurso.tipo)}</span>
                    <span className="ml-auto flex items-center gap-2 font-mono text-data-sm tabular text-text-secondary">
                      {n === 0 && c.distanciaM !== null && (
                        <span className="font-mono text-overline font-bold uppercase text-text-accent">{t('despacho.sugerida')}</span>
                      )}
                      {formatearDistancia(c.distanciaM, idioma)}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      )}

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-strong px-4 py-3">
        <Button variant="ghost" aria-keyshortcuts="Escape" onClick={onCancelar}>
          {t('despacho.cancelar')} <Kbd>Esc</Kbd>
        </Button>
        <Button variant="primary" aria-keyshortcuts="Enter" disabled={elegida === null} onClick={() => elegida && onConfirmar(elegida.recurso)}>
          {t('despacho.confirmar')} <Kbd>Enter</Kbd>
        </Button>
      </div>
    </section>
  );
}
