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

  it('no muestra "Invalid Date" con eventos antiguos {hora, evento} en el timeline', () => {
    const antiguo = {
      ...inc('x', 'Medio'),
      timeline: [{ hora: '14:02', evento: 'Llamada registrada' }, { descripcion: 'Sin fecha' }],
    } as unknown as Incidente;
    render(<PanelMesa {...props} incidentes={[antiguo]} seleccionadoId="x" />);
    const timeline = screen.getByRole('region', { name: 'Timeline' });
    expect(timeline.textContent).not.toContain('Invalid Date');
    expect(within(timeline).getByText(/Llamada registrada/).textContent).toContain('14:02');
    expect(within(timeline).getByText(/Sin fecha/).textContent).toContain('--:--');
  });

  it('la bandeja de reportes entrantes lista solo los no confirmados, el más reciente primero', () => {
    const reportes: Reporte[] = [
      { id: 'r1', tipo: 'INCENDIO', lat: -33.4, lng: -70.6, imagen_url: null, estado_validacion: 'No confirmado', creado_en: '2026-10-04T10:00:00Z' },
      { id: 'r2', tipo: 'VIA_BLOQUEADA', lat: -33.5, lng: -70.7, imagen_url: null, estado_validacion: 'Confirmado' },
      { id: 'r3', tipo: 'FUGA_GAS', lat: 1.2, lng: -77.3, imagen_url: 'https://x/foto.jpg', estado_validacion: 'No confirmado', creado_en: '2026-10-04T11:00:00Z' },
    ];
    render(<PanelMesa {...props} reportes={reportes} />);
    const bandeja = screen.getByRole('region', { name: 'Bandeja de Reportes Entrantes' });
    expect(within(bandeja).getByText('Reportes entrantes · 2 sin confirmar')).toBeTruthy();
    const items = within(bandeja).getAllByRole('listitem').map((li) => li.textContent);
    expect(items).toEqual([expect.stringContaining('Fuga de gas'), expect.stringContaining('Incendio')]);
    expect(within(bandeja).getByRole('link', { name: 'Foto' })).toHaveProperty('href', 'https://x/foto.jpg');
  });

  it('al elegir un reporte de la bandeja lo notifica (para centrar el mapa) y lo marca como actual', async () => {
    const reporte: Reporte = { id: 'r1', tipo: 'INCENDIO', lat: -33.4, lng: -70.6, imagen_url: null, estado_validacion: 'No confirmado' };
    const onSeleccionarReporte = vi.fn();
    const { rerender } = render(<PanelMesa {...props} reportes={[reporte]} onSeleccionarReporte={onSeleccionarReporte} />);

    await userEvent.click(screen.getByRole('button', { name: 'Ver reporte r1 en el mapa' }));
    expect(onSeleccionarReporte).toHaveBeenCalledWith(reporte);

    rerender(<PanelMesa {...props} reportes={[reporte]} reporteSeleccionadoId="r1" onSeleccionarReporte={onSeleccionarReporte} />);
    expect(screen.getByRole('button', { name: 'Ver reporte r1 en el mapa' }).getAttribute('aria-current')).toBe('true');
  });

  it('la bandeja se muestra vacía cuando no hay reportes pendientes', () => {
    render(<PanelMesa {...props} />);
    const bandeja = screen.getByRole('region', { name: 'Bandeja de Reportes Entrantes' });
    expect(within(bandeja).getByText('Sin reportes pendientes')).toBeTruthy();
  });

  it('alterna el modo de trazado', async () => {
    const onAlternarDibujo = vi.fn();
    render(<PanelMesa {...props} onAlternarDibujo={onAlternarDibujo} />);
    await userEvent.click(screen.getByRole('button', { name: 'Trazar zona' }));
    expect(onAlternarDibujo).toHaveBeenCalledOnce();
  });
});

describe('PanelMesa (acciones del operador)', () => {
  const reporte: Reporte = { id: 'r1', tipo: 'INCENDIO', lat: 1, lng: 2, imagen_url: null, estado_validacion: 'No confirmado' };

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
