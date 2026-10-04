// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Incidente, Reporte } from '@argos/shared';
import { PanelMesa, ordenarIncidentes } from './PanelMesa';

afterEach(cleanup);

const inc = (id: string, nivel: Incidente['nivel_criticidad'], estado: Incidente['estado'] = 'Abierto'): Incidente => ({
  id,
  titulo: `Incidente ${id}`,
  nivel_criticidad: nivel,
  estado,
  geometria: { type: 'Point', coordinates: [0, 0] },
  timeline: [{ timestamp: '2026-01-01T10:30:00Z', descripcion: 'Reporte inicial' }],
});

const props = {
  incidentes: [inc('b', 'Bajo'), inc('c', 'Crítico'), inc('m', 'Medio')],
  reportes: [] as readonly Reporte[],
  seleccionadoId: null,
  onSeleccionar: vi.fn(),
  dibujando: false,
  onAlternarDibujo: vi.fn(),
};

describe('ordenarIncidentes', () => {
  it('ordena de más a menos crítico y deja los resueltos al final de su nivel', () => {
    const r = ordenarIncidentes([inc('1', 'Medio', 'Resuelto'), inc('2', 'Medio'), inc('3', 'Crítico')]);
    expect(r.map((i) => i.id)).toEqual(['3', '2', '1']);
  });
});

describe('PanelMesa', () => {
  it('lista los incidentes por criticidad', () => {
    render(<PanelMesa {...props} />);
    const items = within(screen.getByRole('list', { name: 'Incidentes' })).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Incidente c'),
      expect.stringContaining('Incidente m'),
      expect.stringContaining('Incidente b'),
    ]);
  });

  it('notifica la selección al hacer clic', async () => {
    const onSeleccionar = vi.fn();
    render(<PanelMesa {...props} onSeleccionar={onSeleccionar} />);
    await userEvent.click(screen.getByRole('button', { name: /Incidente m/ }));
    expect(onSeleccionar).toHaveBeenCalledWith('m');
  });

  it('muestra el timeline del incidente seleccionado', () => {
    render(<PanelMesa {...props} seleccionadoId="c" />);
    expect(within(screen.getByRole('region', { name: 'Timeline' })).getByText(/Reporte inicial/)).toBeTruthy();
  });

  it('avisa de reportes no confirmados', () => {
    const reportes: Reporte[] = [
      { id: 'r1', tipo: 'Incendio', lat: -33.4, lng: -70.6, imagen_url: null, estado_validacion: 'No confirmado' },
      { id: 'r2', tipo: 'Bloqueo', lat: -33.5, lng: -70.7, imagen_url: null, estado_validacion: 'Confirmado' },
    ];
    render(<PanelMesa {...props} reportes={reportes} />);
    expect(screen.getByText('1 reporte(s) sin confirmar')).toBeTruthy();
  });

  it('alterna el modo de trazado', async () => {
    const onAlternarDibujo = vi.fn();
    render(<PanelMesa {...props} onAlternarDibujo={onAlternarDibujo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Trazar zona' }));
    expect(onAlternarDibujo).toHaveBeenCalledOnce();
  });
});

describe('PanelMesa (acciones del operador)', () => {
  const reporte: Reporte = { id: 'r1', tipo: 'Incendio', lat: 1, lng: 2, imagen_url: null, estado_validacion: 'No confirmado' };

  it('confirma y descarta reportes sin confirmar', async () => {
    const onConfirmarReporte = vi.fn();
    const onDescartarReporte = vi.fn();
    render(<PanelMesa {...props} reportes={[reporte]} onConfirmarReporte={onConfirmarReporte} onDescartarReporte={onDescartarReporte} />);

    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reporte r1' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar reporte r1' }));
    expect(onConfirmarReporte).toHaveBeenCalledWith(reporte);
    expect(onDescartarReporte).toHaveBeenCalledWith(reporte);
  });

  it('cambia el estado del incidente seleccionado ofreciendo solo los otros estados', async () => {
    const onCambiarEstadoIncidente = vi.fn();
    render(<PanelMesa {...props} seleccionadoId="c" onCambiarEstadoIncidente={onCambiarEstadoIncidente} />);
    const grupo = screen.getByRole('group', { name: 'Estado del incidente' });

    expect(within(grupo).queryByRole('button', { name: 'Marcar Abierto' })).toBeNull();
    await userEvent.click(within(grupo).getByRole('button', { name: 'Marcar Resuelto' }));
    expect(onCambiarEstadoIncidente).toHaveBeenCalledWith(props.incidentes[1], 'Resuelto');
  });

  it('muestra Salir solo si hay manejador', async () => {
    const onCerrarSesion = vi.fn();
    const { rerender } = render(<PanelMesa {...props} />);
    expect(screen.queryByRole('button', { name: 'Salir' })).toBeNull();
    rerender(<PanelMesa {...props} onCerrarSesion={onCerrarSesion} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(onCerrarSesion).toHaveBeenCalled();
  });
});
