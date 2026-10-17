// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { EstadoSla } from '@argos/shared';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { CronometroUnidad, datosCronometro } from './CronometroUnidad';

afterEach(cleanup);

const sla = (nivel: EstadoSla['nivel'], transcurridoSeg: number): EstadoSla => ({ recursoId: 'r1', hito: 'EN_RUTA', transcurridoSeg, limiteSeg: 120, nivel });

describe('datosCronometro', () => {
  it('traduce el nivel de dominio al visual y formatea mm:ss', () => {
    expect(datosCronometro(sla('EN_TIEMPO', 5))).toEqual({ tiempo: '00:05', nivel: 'en_tiempo' });
    expect(datosCronometro(sla('ALERTA', 100))).toEqual({ tiempo: '01:40', nivel: 'alerta' });
    expect(datosCronometro(sla('VENCIDO', 125.7))).toEqual({ tiempo: '02:05', nivel: 'vencido' });
  });

  it('NO_APLICA y la ausencia de SLA no se dibujan', () => {
    expect(datosCronometro(sla('NO_APLICA', 0))).toBeNull();
    expect(datosCronometro(undefined)).toBeNull();
  });
});

describe('CronometroUnidad', () => {
  it('no pinta nada si el SLA no aplica', () => {
    const { container } = render(<CronometroUnidad sla={sla('NO_APLICA', 0)} />);
    expect(container.firstChild).toBeNull();
  });

  it('usa las palabras del idioma de la consola', () => {
    render(
      <IdiomaProvider inicial="en">
        <CronometroUnidad sla={sla('VENCIDO', 130)} />
      </IdiomaProvider>,
    );
    expect(screen.getByRole('timer', { name: '02:10, overdue' })).toBeTruthy();
  });
});
