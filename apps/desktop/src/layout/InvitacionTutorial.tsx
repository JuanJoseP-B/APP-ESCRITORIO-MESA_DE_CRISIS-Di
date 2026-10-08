import { Button, Glyph } from '@argos/ui';
import { useTexto } from '../i18n/IdiomaProvider';
import { useTutorial } from './TutorialProvider';

/**
 * Invitación del primer arranque: una tira sobre el mapa, sin telón ni foco robado, que ofrece el recorrido guiado.
 * Desaparece al aceptar o al decir «Ahora no»; en ambos casos no vuelve a aparecer (el tutorial sigue en Ajustes y F1).
 */
export function InvitacionTutorial() {
  const { t } = useTexto();
  const tutorial = useTutorial();
  if (!tutorial || tutorial.visto || tutorial.activo) return null;
  return (
    <section
      aria-label={t('tutorial.invitacion.aria')}
      className="absolute inset-x-0 bottom-4 z-toolbar mx-auto flex w-fit max-w-full items-center gap-3 border border-border-strong bg-surface-panel px-3 py-2 shadow-overlay"
    >
      <Glyph shape="diamond" />
      <p className="font-ui text-body-md text-text-primary">{t('tutorial.invitacion.texto')}</p>
      <Button size="sm" variant="secondary" onClick={tutorial.iniciar}>
        {t('tutorial.invitacion.aceptar')}
      </Button>
      <Button size="sm" variant="ghost" onClick={tutorial.descartarInvitacion}>
        {t('tutorial.invitacion.rechazar')}
      </Button>
    </section>
  );
}
