import type { ConfianzaAsesor } from '@argos/shared';
import { Badge, Button, Glyph, Kbd, SectionHeader, type EnfasisBadge, type TonoBadge } from '@argos/ui';
import { formatearDistancia } from '../domain/despacho';
import type { EstadoAsesor } from '../hooks/useAsesor';
import { textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import './TarjetaAsesor.css';

export interface TarjetaAsesorProps {
  readonly estado: EstadoAsesor;
  /** Menos movimiento: el esqueleto de «analizando» no se anima. */
  readonly reducirMovimiento?: boolean;
  /** Abre la confirmación por acción; no cambia nada por sí solo. */
  readonly onAplicar: () => void;
  /** Rechaza la sugerencia y lo deja en la bitácora. */
  readonly onDescartar: () => void;
  /** Cierra la tarjeta sin registrar nada (Esc). */
  readonly onCerrar: () => void;
}

/** Confianza → tono y énfasis del distintivo; la palabra y el glifo la dicen aunque se pierda el color. */
const DISTINTIVO_CONFIANZA: Readonly<Record<ConfianzaAsesor, { readonly tono: TonoBadge; readonly enfasis: EnfasisBadge }>> = {
  ALTA: { tono: 'success', enfasis: 'tint' },
  MEDIA: { tono: 'warning', enfasis: 'tint' },
  BAJA: { tono: 'warning', enfasis: 'solid' },
};

const ETIQUETA = 'px-4 pt-3 font-mono text-overline uppercase text-text-muted';

/**
 * Recomendación del asesor táctico para el incidente seleccionado. Se identifica como motor de reglas, no como
 * un modelo. Solo propone: nada cambia hasta que el operador confirma cada acción.
 */
export function TarjetaAsesor({ estado, reducirMovimiento = false, onAplicar, onDescartar, onCerrar }: TarjetaAsesorProps) {
  const { t, idioma } = useTexto();
  if (estado.fase === 'inactivo') return null;

  const cabecera = <SectionHeader as="h3" title={t('asesor.titulo')} />;

  if (estado.fase === 'analizando') {
    const quieto = reducirMovimiento ? ' ag-esqueleto--quieto' : '';
    return (
      <section aria-label={t('asesor.titulo')} aria-busy="true" className="shrink-0 bg-surface-raised">
        {cabecera}
        <div role="status" className="px-4 pb-3">
          <p className="font-mono text-data-sm text-text-secondary">{t('asesor.analizando')}</p>
          <div aria-hidden="true" className="mt-2 flex flex-col gap-2">
            <div className={`ag-esqueleto ag-esqueleto--largo${quieto}`} />
            <div className={`ag-esqueleto ag-esqueleto--medio${quieto}`} />
            <div className={`ag-esqueleto ag-esqueleto--corto${quieto}`} />
          </div>
        </div>
      </section>
    );
  }

  if (estado.fase === 'error') {
    return (
      <section aria-label={t('asesor.titulo')} className="shrink-0 bg-surface-raised">
        {cabecera}
        <div role="alert" className="mx-4 mb-2 border border-status-critical bg-status-critical-bg px-3 py-2">
          <p className="flex items-center gap-2 font-mono text-overline uppercase text-status-critical">
            <Glyph shape="square" />
            {t('asesor.error.titulo')}
          </p>
          <p className="mt-1 font-ui text-body-sm text-text-primary">{t(`asesor.error.${estado.error}`)}</p>
          {estado.error !== 'SIN_RECOMENDACION' && estado.detalle !== '' && (
            <p className="mt-1 font-mono text-data-sm text-text-secondary">{estado.detalle}</p>
          )}
        </div>
        <p className="px-4 pb-2 font-ui text-body-sm text-text-secondary">{t('asesor.error.manual')}</p>
        <div className="flex px-4 pb-3">
          <Button size="sm" variant="ghost" aria-keyshortcuts="Escape" onClick={onCerrar}>
            {t('asesor.cerrar')} <Kbd>Esc</Kbd>
          </Button>
        </div>
      </section>
    );
  }

  const { snapshot, recomendacion: rec } = estado;
  const libres = (id: string): number => {
    const r = snapshot.refugios.find((x) => x.id === id);
    return r ? r.capacidad - r.ocupacion : 0;
  };
  const refugio = snapshot.refugios.find((r) => r.id === rec.refugioSugeridoId) ?? null;
  const { tono, enfasis } = DISTINTIVO_CONFIANZA[rec.confianza];
  const { CALIENTE, TIBIA, EVACUACION } = rec.perimetroSugerido;

  return (
    <section aria-label={t('asesor.titulo')} className="shrink-0 bg-surface-raised">
      {cabecera}
      <div className="flex items-center gap-2 px-4 pb-2">
        <span className="font-mono text-overline uppercase text-text-muted">{t('asesor.confianza')}</span>
        <Badge tone={tono} emphasis={enfasis}>
          {t(`asesor.confianza.${rec.confianza}`)}
        </Badge>
      </div>

      <p className={ETIQUETA}>{t('asesor.unidades')}</p>
      {rec.unidades.length === 0 ? (
        <p className="px-4 py-1 font-mono text-data-sm text-text-muted">{t('asesor.unidades.vacio')}</p>
      ) : (
        <ul aria-label={t('asesor.unidades')}>
          {rec.unidades.map((u) => {
            const recurso = snapshot.recursos.find((r) => r.id === u.idRecurso);
            return (
              <li key={u.idRecurso} className="flex min-h-row items-center gap-2 border-b border-border-subtle px-4 py-1">
                <span className="font-mono text-data-md font-bold tabular text-text-primary">{recurso?.indicativo ?? u.idRecurso}</span>
                <span className="min-w-0 font-ui text-body-sm text-text-secondary">
                  {recurso ? `${textoTipoRecurso(t, recurso.tipo)} · ` : ''}
                  {u.rol}
                </span>
                <span className="ml-auto shrink-0 font-mono text-data-sm tabular text-text-secondary">
                  {t('asesor.unidad.eta', { min: u.etaMin })}
                  {recurso ? ` · ${formatearDistancia(recurso.distanciaM, idioma)}` : ''}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className={ETIQUETA}>{t('asesor.justificacion')}</p>
      <p className="px-4 pt-1 font-ui text-body-sm text-text-primary">{rec.justificacion}</p>

      <p className={ETIQUETA}>{t('asesor.perimetro')}</p>
      <p className="px-4 pt-1 font-mono text-data-md font-bold tabular text-text-primary">
        {t('asesor.perimetro.valor', { caliente: CALIENTE, tibia: TIBIA, evacuacion: EVACUACION })}
      </p>
      <p className="px-4 font-ui text-body-sm text-text-secondary">{t('asesor.perimetro.mapa')}</p>

      <p className={ETIQUETA}>{t('asesor.refugio')}</p>
      <p className="px-4 pt-1 font-mono text-data-sm text-text-primary">
        {refugio ? t('asesor.refugio.valor', { nombre: refugio.nombre, libres: libres(refugio.id) }) : t('asesor.refugio.ninguno')}
      </p>

      {rec.advertencias.length > 0 && (
        <>
          <p className={ETIQUETA}>{t('asesor.advertencias')}</p>
          <ul aria-label={t('asesor.advertencias')} className="px-4 pt-1">
            {rec.advertencias.map((a) => (
              <li key={a} className="flex items-start gap-2 py-0.5 font-ui text-body-sm text-text-primary">
                <span className="mt-1 shrink-0 text-status-warning">
                  <Glyph shape="triangle" />
                </span>
                {a}
              </li>
            ))}
          </ul>
        </>
      )}

      <div className="flex flex-wrap gap-2 px-4 pb-3 pt-4">
        <Button size="sm" variant="primary" onClick={onAplicar}>
          {t('asesor.aplicar')}
        </Button>
        <Button size="sm" variant="ghost" onClick={onDescartar}>
          {t('asesor.descartar')}
        </Button>
        <Button size="sm" variant="ghost" aria-keyshortcuts="Escape" onClick={onCerrar}>
          {t('asesor.cerrar')} <Kbd>Esc</Kbd>
        </Button>
      </div>
    </section>
  );
}
