import { useRef } from 'react';
import { X } from 'lucide-react';
import { Button, Kbd, SectionHeader } from '@argos/ui';
import { GRUPOS_ATAJOS } from '../domain/atajos';
import { useDialogoModal } from '../hooks/useDialogoModal';
import { useTexto } from '../i18n/IdiomaProvider';

export interface HojaAtajosProps {
  readonly onCerrar: () => void;
}

/**
 * Hoja de atajos de teclado (F1 o «?»): todas las teclas de la consola agrupadas en Navegación, Llamadas, Despacho y
 * Paneles. Diálogo modal con el foco atrapado; Esc, F1, «?» o el botón la cierran y el foco vuelve a quien la abrió.
 */
export function HojaAtajos({ onCerrar }: HojaAtajosProps) {
  const { t } = useTexto();
  const panel = useRef<HTMLElement>(null);
  const alPulsar = useDialogoModal(panel, onCerrar, ['F1', '?']);

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-popover" onClick={onCerrar} />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('atajos.titulo')}
        onKeyDown={alPulsar}
        className="fixed inset-y-0 right-0 z-modal flex w-panel max-w-full flex-col border-l border-border-strong bg-surface-panel shadow-overlay"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-strong px-4 py-3">
          <h2 className="font-display text-title-md text-text-primary">{t('atajos.titulo')}</h2>
          <Button size="sm" variant="ghost" square data-foco-inicial aria-label={t('atajos.cerrar')} title={t('atajos.cerrar')} onClick={onCerrar}>
            <X aria-hidden="true" size={16} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <p className="px-4 py-3 font-ui text-body-sm text-text-secondary">{t('atajos.pista')}</p>
          {GRUPOS_ATAJOS.map((grupo, n) => (
            <section key={grupo.id} aria-label={t(grupo.titulo)}>
              <SectionHeader index={String(n + 1).padStart(2, '0')} title={t(grupo.titulo)} />
              <dl className="pb-3">
                {grupo.atajos.map((a) => (
                  <div key={a.clave} className="flex min-h-row items-center justify-between gap-3 px-4 py-1">
                    <dt className="font-ui text-body-md text-text-primary">{t(a.clave)}</dt>
                    <dd className="m-0 flex shrink-0 items-center gap-1">
                      {a.teclas.map((tecla) => (
                        <Kbd key={tecla} decorative={false}>
                          {tecla}
                        </Kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </aside>
    </>
  );
}
