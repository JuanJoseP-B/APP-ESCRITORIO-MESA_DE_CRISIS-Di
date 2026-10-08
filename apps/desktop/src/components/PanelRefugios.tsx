import type { ZonaPublica } from '@argos/shared';
import { SectionHeader, ShelterGauge } from '@argos/ui';
import { useTexto } from '../i18n/IdiomaProvider';

interface Props {
  readonly zonas: readonly ZonaPublica[];
  /** Recibe el incremento relativo (±PASO); quien persiste lo aplica de forma atómica. */
  readonly onCambiarOcupacion: (zona: ZonaPublica, delta: number) => void;
  /** Número de la sección en el panel que lo aloja. */
  readonly indice?: string;
}

const PASO = 5;

export function PanelRefugios({ zonas, onCambiarOcupacion, indice = '05' }: Props) {
  const { t } = useTexto();
  const refugios = zonas.filter((z) => z.tipo === 'Refugio');
  if (refugios.length === 0) return null;

  return (
    <section aria-label={t('refugios.titulo')} className="shrink-0">
      <SectionHeader index={indice} title={t('refugios.titulo')} count={refugios.length} />
      <ul>
        {refugios.map((z) => (
          <li key={z.id}>
            <ShelterGauge
              name={z.nombre}
              current={z.capacidad_actual}
              capacity={z.capacidad_maxima}
              step={PASO}
              decrementLabel={t('refugios.reducir', { nombre: z.nombre })}
              incrementLabel={t('refugios.aumentar', { nombre: z.nombre })}
              onDecrement={() => onCambiarOcupacion(z, -PASO)}
              onIncrement={() => onCambiarOcupacion(z, PASO)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
