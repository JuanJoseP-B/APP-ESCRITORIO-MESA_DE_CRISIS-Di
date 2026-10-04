// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ZonaPublica } from '@argos/shared';
import { PanelRefugios } from './PanelRefugios';

afterEach(cleanup);

const zona = (id: string, actual: number, max = 10, tipo: ZonaPublica['tipo'] = 'Refugio'): ZonaPublica => ({
  id,
  tipo,
  nombre: `Zona ${id}`,
  geometria: { type: 'Point', coordinates: [0, 0] },
  capacidad_actual: actual,
  capacidad_maxima: max,
});

describe('PanelRefugios', () => {
  it('solo lista refugios y emite la ocupación acotada', async () => {
    const onCambiarOcupacion = vi.fn();
    const zonas = [zona('a', 8), zona('b', 0, 10, 'Bloqueo de Vía')];
    render(<PanelRefugios zonas={zonas} onCambiarOcupacion={onCambiarOcupacion} />);

    expect(screen.queryByText('Zona b')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar ocupación de Zona a' }));
    expect(onCambiarOcupacion).toHaveBeenCalledWith(zonas[0], 10);
  });

  it('deshabilita los límites', () => {
    render(<PanelRefugios zonas={[zona('a', 0), zona('c', 10)]} onCambiarOcupacion={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Reducir ocupación de Zona a' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Aumentar ocupación de Zona c' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
