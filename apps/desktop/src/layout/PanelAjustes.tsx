import { useRef } from 'react';
import { X } from 'lucide-react';
import { Badge, Button, Kbd, SectionHeader, SegmentedControl, Switch } from '@argos/ui';
import { useDialogoModal } from '../hooks/useDialogoModal';
import { usePreferencias } from '../hooks/usePreferencias';
import { IDIOMAS, type Idioma } from '../i18n/idioma';
import { useTexto } from '../i18n/IdiomaProvider';
import { TEMAS_PREFERIDOS, type TemaPreferido } from '../tema';

export interface PanelAjustesProps {
  readonly onCerrar: () => void;
  /** Abre la hoja de atajos de teclado (Ayuda); la consola cierra antes estos ajustes. */
  readonly onAbrirAtajos?: () => void;
}

/**
 * Drawer de ajustes (apariencia, idioma, accesibilidad y ayuda). Los cambios se aplican al instante.
 * El foco queda atrapado dentro, Esc lo cierra y al cerrar vuelve a quien lo abrió. Sin telón
 * translúcido: un capturador invisible cierra al hacer clic fuera.
 */
export function PanelAjustes({ onCerrar, onAbrirAtajos }: PanelAjustesProps) {
  const { t } = useTexto();
  const { preferencias, fijar } = usePreferencias();
  const panel = useRef<HTMLElement>(null);

  const alPulsar = useDialogoModal(panel, onCerrar);

  const opcionesTema = TEMAS_PREFERIDOS.map((value) => ({ value, label: t(`ajustes.tema.${value}`) }));
  const opcionesIdioma = IDIOMAS.map((value) => ({ value, label: t(`idioma.${value}`) }));

  return (
    <>
      <div aria-hidden="true" className="fixed inset-0 z-popover" onClick={onCerrar} />
      <aside
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={t('ajustes.titulo')}
        onKeyDown={alPulsar}
        className="fixed inset-y-0 right-0 z-modal flex w-panel max-w-full flex-col border-l border-border-strong bg-surface-panel shadow-overlay"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-border-strong px-4 py-3">
          <h2 className="font-display text-title-md text-text-primary">{t('ajustes.titulo')}</h2>
          <Button size="sm" variant="ghost" square data-foco-inicial aria-label={t('ajustes.cerrar')} title={t('ajustes.cerrar')} onClick={onCerrar}>
            <X aria-hidden="true" size={16} />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <section aria-label={t('ajustes.apariencia')}>
            <SectionHeader index="01" title={t('ajustes.apariencia')} />
            <div className="flex flex-col gap-2 px-4 pb-4">
              <p className="font-ui text-body-md text-text-primary">{t('ajustes.tema')}</p>
              <SegmentedControl<TemaPreferido>
                label={t('ajustes.tema')}
                options={opcionesTema}
                value={preferencias.tema}
                onChange={(tema) => fijar({ tema })}
              />
            </div>
          </section>

          <section aria-label={t('ajustes.idioma')}>
            <SectionHeader index="02" title={t('ajustes.idioma')} />
            <div className="flex flex-col gap-2 px-4 pb-4">
              <p className="font-ui text-body-md text-text-primary">{t('ajustes.idioma.consola')}</p>
              <SegmentedControl<Idioma>
                label={t('ajustes.idioma.consola')}
                options={opcionesIdioma}
                value={preferencias.idioma}
                onChange={(idioma) => fijar({ idioma })}
              />
            </div>
          </section>

          <section aria-label={t('ajustes.accesibilidad')}>
            <SectionHeader index="03" title={t('ajustes.accesibilidad')} />
            <div className="flex flex-col gap-4 px-4 pb-4">
              <Switch
                label={t('ajustes.movimiento')}
                hint={t('ajustes.movimiento.ayuda')}
                onLabel={t('ajustes.activado')}
                offLabel={t('ajustes.desactivado')}
                checked={preferencias.reducirMovimiento}
                onChange={(reducirMovimiento) => fijar({ reducirMovimiento })}
              />
              <Switch
                label={t('ajustes.textoGrande')}
                hint={t('ajustes.textoGrande.ayuda')}
                onLabel={t('ajustes.activado')}
                offLabel={t('ajustes.desactivado')}
                checked={preferencias.textoGrande}
                onChange={(textoGrande) => fijar({ textoGrande })}
              />
            </div>
          </section>

          <section aria-label={t('ajustes.ayuda')}>
            <SectionHeader index="04" title={t('ajustes.ayuda')} />
            <div className="flex flex-wrap items-center gap-3 px-4 pb-4">
              {onAbrirAtajos && (
                <Button size="sm" variant="secondary" aria-haspopup="dialog" aria-keyshortcuts="F1" onClick={onAbrirAtajos}>
                  {t('ajustes.atajos')} <Kbd>F1</Kbd>
                </Button>
              )}
              <Button size="sm" variant="secondary" disabled>
                {t('ajustes.tutorial')}
              </Button>
              <Badge tone="neutral" emphasis="outline">
                {t('ajustes.proximamente')}
              </Badge>
            </div>
          </section>
        </div>
      </aside>
    </>
  );
}
