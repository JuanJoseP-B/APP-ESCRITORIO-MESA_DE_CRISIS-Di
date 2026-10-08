import { Glyph, type FormaGlifo } from '@argos/ui';

interface Entrada {
  readonly palabra: string;
  readonly shape: FormaGlifo;
  readonly clase: string;
}

/** Cada entrada repite el color de su capa (ver `domain/geojson.ts`) con glifo y palabra. */
const ENTRADAS: readonly Entrada[] = [
  { palabra: 'Incidente crítico', shape: 'square', clase: 'text-status-critical' },
  { palabra: 'Incidente medio', shape: 'triangle', clase: 'text-status-warning' },
  { palabra: 'Incidente bajo', shape: 'circle', clase: 'text-status-success' },
  { palabra: 'Refugio', shape: 'circle', clase: 'text-status-success' },
  { palabra: 'Bloqueo de vía', shape: 'triangle', clase: 'text-status-warning' },
  { palabra: 'Llamada sin confirmar', shape: 'ring', clase: 'text-text-primary' },
];

/** Leyenda del mapa: panel sólido, sin transparencias. */
export function LeyendaMapa() {
  return (
    <section
      aria-label="Leyenda del mapa"
      className="border border-border-strong bg-surface-panel px-3 py-2 shadow-overlay"
    >
      <p className="font-mono text-overline uppercase text-text-secondary">Leyenda</p>
      <ul className="mt-1 space-y-1 font-mono text-data-sm text-text-primary">
        {ENTRADAS.map((e) => (
          <li key={e.palabra} className="flex items-center gap-2">
            <span className={e.clase}>
              <Glyph shape={e.shape} />
            </span>
            {e.palabra}
          </li>
        ))}
      </ul>
    </section>
  );
}
