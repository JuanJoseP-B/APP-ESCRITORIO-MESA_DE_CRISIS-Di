import { Button, Glyph } from '@argos/ui';
import type { AvisoSla } from '../hooks/useAvisosSla';
import { useTexto } from '../i18n/IdiomaProvider';

export interface AvisosSlaProps {
  readonly avisos: readonly AvisoSla[];
  /** Con varios vencimientos a la vez se muestra un único aviso con el total, que se cierra de una vez. */
  readonly agrupado?: boolean;
  /** Indicativo completo por id de recurso. */
  readonly indicativos: ReadonlyMap<string, string>;
  readonly onDescartar: (id: number) => void;
  readonly onDescartarTodos?: () => void;
}

const CLASE_AVISO =
  'pointer-events-auto flex items-center gap-3 border border-status-critical bg-surface-panel px-3 py-2 font-mono text-data-sm text-status-critical shadow-overlay';

/**
 * Aviso no modal de cada vencimiento de SLA nuevo. La región `aria-live="polite"` existe siempre (vacía) para que
 * los lectores de pantalla anuncien lo que se agregue sin interrumpir; no roba el foco ni bloquea el mapa.
 */
export function AvisosSla({ avisos, agrupado = false, indicativos, onDescartar, onDescartarTodos }: AvisosSlaProps) {
  const { t } = useTexto();
  return (
    <div role="log" aria-live="polite" aria-label={t('sla.aviso.aria')} className="pointer-events-none absolute left-1/2 top-4 z-toolbar flex -translate-x-1/2 flex-col gap-2">
      {agrupado && avisos.length > 0 ? (
        <p className={CLASE_AVISO}>
          <Glyph shape="square" />
          <span>{t('sla.aviso.agrupado', { n: avisos.length })}</span>
          <Button size="sm" variant="ghost" aria-label={t('sla.aviso.agrupado.cerrar')} onClick={() => onDescartarTodos?.()}>
            <span aria-hidden="true">✕</span>
          </Button>
        </p>
      ) : (
        avisos.map((a) => {
          const unidad = indicativos.get(a.recursoId) ?? a.recursoId;
          return (
            <p key={a.id} className={CLASE_AVISO}>
              <Glyph shape="square" />
              <span>{t('sla.aviso', { unidad })}</span>
              <Button size="sm" variant="ghost" aria-label={t('sla.aviso.cerrar', { unidad })} onClick={() => onDescartar(a.id)}>
                <span aria-hidden="true">✕</span>
              </Button>
            </p>
          );
        })
      )}
    </div>
  );
}
