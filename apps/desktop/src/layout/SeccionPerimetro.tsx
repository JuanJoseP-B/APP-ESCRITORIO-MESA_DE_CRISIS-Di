import type { AnalisisPerimetro, Anillo, Recurso, ZonaPublica } from '@argos/shared';
import { Badge, Glyph, SectionHeader } from '@argos/ui';
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
  const asignadas = analisis.unidadesAsignadasEnZona
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

      {asignadas.length > 0 && (
        <div className="mx-4 mb-2 border border-border-strong bg-surface-raised px-3 py-2">
          <p className="flex items-center gap-2 font-mono text-overline uppercase text-text-secondary">
            <Glyph shape="diamond" />
            {t('analisis.enEscena')}
          </p>
          <ul aria-label={t('analisis.enEscena')} className="mt-1 font-mono text-data-sm text-text-primary">
            {asignadas.map((r) => (
              <li key={r.id} className={FILA} {...resaltable({ tipo: 'unidad', id: r.id })}>
                {t('analisis.alerta.unidad', { unidad: indicativos.get(r.id) ?? r.id, tipo: textoTipoRecurso(t, r.tipo) })}
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="px-4 pt-1 font-mono text-overline uppercase text-text-muted">{t('analisis.refugios')}</p>
      {analisis.refugios.length === 0 ? (
        <p className="px-4 pb-2 font-mono text-data-sm text-text-muted">{t('analisis.refugios.vacio')}</p>
      ) : (
        <ul aria-label={t('analisis.refugios')} className="flex flex-col gap-1 pb-1">
          {analisis.refugios.map((r) => {
            const zona = zonas.find((z) => z.id === r.id);
            const capacidad = zona?.capacidad_maxima ?? 0;
            const ocupacion = Math.max(0, Math.min(zona?.capacidad_actual ?? 0, capacidad));
            const pct = capacidad > 0 ? Math.round((ocupacion / capacidad) * 100) : 0;
            return (
              <li key={r.id} className="ag-refugio-perimetro" {...resaltable({ tipo: 'zona', id: r.id })}>
                <span className="flex items-center justify-between gap-2 text-[13px]">
                  <span className="min-w-0 truncate text-[var(--isla-texto)]">{t('analisis.refugio.detalle', { nombre: r.nombre, anillo: nombreAnillo(r.anillo) })}</span>
                  {r.apto ? <Badge tone="success">{t('analisis.apto')}</Badge> : <Badge tone="critical">{t('analisis.noApto')}</Badge>}
                </span>
                {capacidad > 0 && (
                  <>
                    <span className="ag-medidor" role="meter" aria-label={t('analisis.aforo', { nombre: r.nombre })} aria-valuemin={0} aria-valuemax={capacidad} aria-valuenow={ocupacion}>
                      <span style={{ width: `${pct}%` }} />
                    </span>
                    <span className="font-mono text-[11px] tabular text-[var(--isla-texto-2)]">
                      {String(ocupacion).padStart(String(capacidad).length, '0')}/{capacidad}
                    </span>
                  </>
                )}
              </li>
            );
          })}
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
