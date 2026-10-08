import type { ZonaPublica } from '@argos/shared';
import { SectionHeader, ShelterGauge } from '@argos/ui';

interface Props {
  readonly zonas: readonly ZonaPublica[];
  /** Recibe el incremento relativo (±PASO); quien persiste lo aplica de forma atómica. */
  readonly onCambiarOcupacion: (zona: ZonaPublica, delta: number) => void;
  /** Número de la sección en el panel que lo aloja. */
  readonly indice?: string;
}

const PASO = 5;

export function PanelRefugios({ zonas, onCambiarOcupacion, indice = '05' }: Props) {
  const refugios = zonas.filter((z) => z.tipo === 'Refugio');
  if (refugios.length === 0) return null;

  return (
    <section aria-label="Refugios" className="shrink-0">
      <SectionHeader index={indice} title="Refugios" count={refugios.length} />
      <ul>
        {refugios.map((z) => (
          <li key={z.id}>
            <ShelterGauge
              name={z.nombre}
              current={z.capacidad_actual}
              capacity={z.capacidad_maxima}
              step={PASO}
              decrementLabel={`Reducir ocupación de ${z.nombre}`}
              incrementLabel={`Aumentar ocupación de ${z.nombre}`}
              onDecrement={() => onCambiarOcupacion(z, -PASO)}
              onIncrement={() => onCambiarOcupacion(z, PASO)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
