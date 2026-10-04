// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Recurso } from '@argos/shared';
import { PanelRecursos } from './PanelRecursos';

afterEach(cleanup);

const recursos: readonly Recurso[] = [
  { id: 'a', tipo: 'Bomberos', estado_actual: 'Disponible', incidente_asignado_id: null },
  { id: 'b', tipo: 'Ambulancia', estado_actual: 'Despachado', incidente_asignado_id: 'i1' },
  { id: 'c', tipo: 'Policía', estado_actual: 'Inoperativo', incidente_asignado_id: null },
];

describe('PanelRecursos', () => {
  it('agrupa los recursos por estado', () => {
    render(<PanelRecursos recursos={recursos} incidenteSeleccionadoId={null} onCambiarEstado={vi.fn()} />);
    expect(within(screen.getByRole('group', { name: 'Despachado' })).getByText('b')).toBeTruthy();
    expect(within(screen.getByRole('group', { name: 'Disponible' })).queryByText('b')).toBeNull();
  });

  it('solo ofrece transiciones válidas', () => {
    render(<PanelRecursos recursos={recursos} incidenteSeleccionadoId="i1" onCambiarEstado={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Despachar a' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'En escena a' })).toBeNull();
    expect(screen.getByRole('button', { name: 'En escena b' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Despachar c' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Liberar c' })).toBeTruthy();
  });

  it('deshabilita Despachar sin incidente seleccionado', () => {
    render(<PanelRecursos recursos={recursos} incidenteSeleccionadoId={null} onCambiarEstado={vi.fn()} />);
    expect((screen.getByRole('button', { name: 'Despachar a' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('notifica el cambio de estado solicitado', async () => {
    const onCambiarEstado = vi.fn();
    render(<PanelRecursos recursos={recursos} incidenteSeleccionadoId="i1" onCambiarEstado={onCambiarEstado} />);
    await userEvent.click(screen.getByRole('button', { name: 'Despachar a' }));
    expect(onCambiarEstado).toHaveBeenCalledWith(recursos[0], 'Despachado');
  });
});
