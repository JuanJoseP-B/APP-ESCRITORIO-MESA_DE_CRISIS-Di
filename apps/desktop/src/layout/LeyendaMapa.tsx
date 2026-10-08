import { Glyph, type FormaGlifo } from '@argos/ui';
import type { ClaveTexto } from '../i18n/es';
import { useTexto } from '../i18n/IdiomaProvider';

interface Entrada {
  readonly palabra: ClaveTexto;
  readonly shape: FormaGlifo;
  readonly clase: string;
}

/** Cada entrada repite el color de su capa (ver `domain/geojson.ts`) con glifo y palabra. */
const ENTRADAS: readonly Entrada[] = [
  { palabra: 'leyenda.critico', shape: 'square', clase: 'text-status-critical' },
  { palabra: 'leyenda.medio', shape: 'triangle', clase: 'text-status-warning' },
  { palabra: 'leyenda.bajo', shape: 'circle', clase: 'text-status-success' },
  { palabra: 'leyenda.refugio', shape: 'circle', clase: 'text-status-success' },
  { palabra: 'leyenda.bloqueo', shape: 'triangle', clase: 'text-status-warning' },
  { palabra: 'leyenda.llamada', shape: 'ring', clase: 'text-text-primary' },
];

/** Leyenda del mapa: panel sólido, sin transparencias. */
export function LeyendaMapa() {
  const { t } = useTexto();
  return (
    <section
      aria-label={t('leyenda.aria')}
      className="border border-border-strong bg-surface-panel px-3 py-2 shadow-overlay"
    >
      <p className="font-mono text-overline uppercase text-text-secondary">{t('leyenda.titulo')}</p>
      <ul className="mt-1 space-y-1 font-mono text-data-sm text-text-primary">
        {ENTRADAS.map((e) => (
          <li key={e.palabra} className="flex items-center gap-2">
            <span className={e.clase}>
              <Glyph shape={e.shape} />
            </span>
            {t(e.palabra)}
          </li>
        ))}
      </ul>
    </section>
  );
}
