import type { EstadoSla, NivelSla } from '@argos/shared';
import { CronometroSla, type NivelCronometro, type PalabrasCronometro } from '@argos/ui';
import { formatearCronometro } from '../domain/sla';
import { useTexto } from '../i18n/IdiomaProvider';

/** Nivel de dominio → nivel visual del cronómetro. `NO_APLICA` no se dibuja. */
export const NIVEL_CRONOMETRO: Readonly<Record<Exclude<NivelSla, 'NO_APLICA'>, NivelCronometro>> = {
  EN_TIEMPO: 'en_tiempo',
  ALERTA: 'alerta',
  VENCIDO: 'vencido',
};

/** Palabras de los niveles en el idioma de la consola. */
export function usePalabrasSla(): PalabrasCronometro {
  const { t } = useTexto();
  return { alerta: t('sla.alerta'), vencido: t('sla.vencido') };
}

/** Lo que `UnitChip` necesita de un SLA: tiempo "mm:ss" y nivel; `null` si el SLA no aplica. */
export function datosCronometro(sla: EstadoSla | undefined): { readonly tiempo: string; readonly nivel: NivelCronometro } | null {
  if (!sla || sla.nivel === 'NO_APLICA') return null;
  return { tiempo: formatearCronometro(sla.transcurridoSeg), nivel: NIVEL_CRONOMETRO[sla.nivel] };
}

export interface CronometroUnidadProps {
  readonly sla: EstadoSla | undefined;
  readonly reducirMovimiento?: boolean;
  readonly mostrarPalabra?: boolean;
  readonly className?: string;
}

/** Cronómetro SLA de una unidad con las palabras del idioma; no pinta nada si el SLA no aplica. */
export function CronometroUnidad({ sla, reducirMovimiento = false, mostrarPalabra = true, className }: CronometroUnidadProps) {
  const palabras = usePalabrasSla();
  const datos = datosCronometro(sla);
  if (!datos) return null;
  return (
    <CronometroSla
      nivel={datos.nivel}
      tiempo={datos.tiempo}
      palabras={palabras}
      mostrarPalabra={mostrarPalabra}
      reducirMovimiento={reducirMovimiento}
      className={className}
    />
  );
}
