import type { AnalisisPerimetro, Anillo, Recurso, ZonaPublica } from '@argos/shared';
import { Glyph, SectionHeader } from '@argos/ui';
import type { ObjetivoResaltado } from '../domain/analisisEspacial';
import { etiquetaRadio, type AnilloGenerado } from '../domain/perimetro';
import { textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';

export interface SeccionPerimetroProps {
  readonly indice: string;
  readonly anillos: readonly AnilloGenerado[];
  readonly analisis: AnalisisPerimetro;
  readonly zonas: readonly ZonaPublica[];
  readonly recursos: readonly Recurso[];
  /** Indicativo completo por id de recurso. */
  readonly indicativos: ReadonlyMap<string, string>;
  /** Cursor o foco sobre un ítem: el mapa lo resalta; `null` al soltarlo. */
  readonly onResaltar: (objetivo: ObjetivoResaltado | null) => void;
}

const FILA = 'flex min-h-row items-center gap-2 px-4 py-1 hover:bg-surface-hover focus-visible:shadow-focus focus-visible:outline-none';

/** Análisis espacial del perímetro: unidades en zona caliente, refugios por anillo (aptos o no) y bloqueos afectados. */
export function SeccionPerimetro({ indice, anillos, analisis, zonas, recursos, indicativos, onResaltar }: SeccionPerimetroProps) {
  const { t, idioma } = useTexto();
  const unidades = analisis.unidadesEnZonaCaliente
    .map((id) => recursos.find((r) => r.id === id))
    .filter((r): r is Recurso => r !== undefined);
  const bloqueos = analisis.bloqueosAfectados
    .map((id) => zonas.find((z) => z.id === id))
    .filter((z): z is ZonaPublica => z !== undefined);
  const nombreAnillo = (a: Anillo | 'FUERA'): string => (a === 'FUERA' ? t('analisis.fuera') : t(`anillo.${a}`));

  const resaltable = (objetivo: ObjetivoResaltado) => ({
    tabIndex: 0,
    onMouseEnter: () => onResaltar(objetivo),
    onMouseLeave: () => onResaltar(null),
    onFocus: () => onResaltar(objetivo),
    onBlur: () => onResaltar(null),
  });

  return (
    <section aria-label={t('analisis.titulo')} className="shrink-0">
      <SectionHeader index={indice} title={t('analisis.titulo')} />
      <ul aria-label={t('analisis.radios')} className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 font-mono text-data-sm tabular text-text-secondary">
        {anillos.map((a) => (
          <li key={a.anillo}>
            {t(`anillo.${a.anillo}`)} <span className="font-bold text-text-primary">{etiquetaRadio(a.radioM, idioma)}</span>
          </li>
        ))}
      </ul>

      {unidades.length > 0 ? (
        <div role="alert" className="mx-4 mb-2 border border-status-critical bg-status-critical-bg px-3 py-2">
          <p className="flex items-center gap-2 font-mono text-overline uppercase text-status-critical">
            <Glyph shape="square" />
            {t('analisis.alerta')}
          </p>
          <ul className="mt-1 font-mono text-data-sm text-text-primary">
            {unidades.map((r) => (
              <li key={r.id} className={FILA} {...resaltable({ tipo: 'unidad', id: r.id })}>
                {t('analisis.alerta.unidad', { unidad: indicativos.get(r.id) ?? r.id, tipo: textoTipoRecurso(t, r.tipo) })}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="px-4 pb-2 font-mono text-data-sm text-text-muted">{t('analisis.sinAlerta')}</p>
      )}

      <p className="px-4 pt-1 font-mono text-overline uppercase text-text-muted">{t('analisis.refugios')}</p>
      {analisis.refugios.length === 0 ? (
        <p className="px-4 pb-2 font-mono text-data-sm text-text-muted">{t('analisis.refugios.vacio')}</p>
      ) : (
        <ul aria-label={t('analisis.refugios')}>
          {analisis.refugios.map((r) => (
            <li key={r.id} className={`${FILA} justify-between font-mono text-data-sm`} {...resaltable({ tipo: 'zona', id: r.id })}>
              <span className="text-text-primary">{t('analisis.refugio.detalle', { nombre: r.nombre, anillo: nombreAnillo(r.anillo) })}</span>
              <span className={`flex items-center gap-1 font-bold ${r.apto ? 'text-status-success' : 'text-status-critical'}`}>
                <Glyph shape={r.apto ? 'circle' : 'square'} />
                {r.apto ? t('analisis.apto') : t('analisis.noApto')}
              </span>
            </li>
          ))}
        </ul>
      )}

      <p className="px-4 pt-2 font-mono text-overline uppercase text-text-muted">{t('analisis.bloqueos')}</p>
      {bloqueos.length === 0 ? (
        <p className="px-4 pb-2 font-mono text-data-sm text-text-muted">{t('analisis.bloqueos.vacio')}</p>
      ) : (
        <ul aria-label={t('analisis.bloqueos')}>
          {bloqueos.map((z) => (
            <li key={z.id} className={`${FILA} font-mono text-data-sm text-text-primary`} {...resaltable({ tipo: 'zona', id: z.id })}>
              <span className="text-status-warning">
                <Glyph shape="triangle" />
              </span>
              {z.nombre}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
