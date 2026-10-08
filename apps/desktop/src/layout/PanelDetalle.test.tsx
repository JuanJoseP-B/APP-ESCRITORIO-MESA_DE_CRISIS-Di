// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Incidente, Recurso, ZonaPublica } from '@argos/shared';
import { PanelDetalle, type PanelDetalleProps } from './PanelDetalle';

afterEach(cleanup);

const incidente: Incidente = {
  id: 'inc-1-a3f',
  titulo: 'Fuga de gas en sector',
  nivel_criticidad: 'Crítico',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [0, 0] },
  timeline: [
    { timestamp: '2026-10-07T11:30:00Z', descripcion: 'Incidente registrado' },
    { timestamp: '2026-10-07T11:40:00Z', descripcion: 'Validado por operador' },
  ],
};

const unidad = (id: string, estado: Recurso['estado_actual'], incidenteId: string | null = null): Recurso => ({
  id,
  etiqueta: id,
  tipo: 'Bomberos',
  estado_actual: estado,
  incidente_asignado_id: incidenteId,
});

const recursos: readonly Recurso[] = [
  unidad('U01', 'Disponible'),
  unidad('M11', 'Disponible'),
  unidad('U02', 'Despachado', incidente.id),
  unidad('P01', 'En Escena', 'otro-incidente'),
  unidad('M10', 'Inoperativo'),
];

const refugio: ZonaPublica = {
  id: 'z1',
  tipo: 'Refugio',
  nombre: 'Coliseo Municipal',
  geometria: { type: 'Point', coordinates: [0, 0] },
  capacidad_actual: 45,
  capacidad_maxima: 200,
};

const base = (extra: Partial<PanelDetalleProps> = {}): PanelDetalleProps => ({
  incidente,
  recursos,
  zonas: [refugio],
  ahora: Date.parse('2026-10-07T12:00:00Z'),
  onCambiarEstadoIncidente: vi.fn(),
  onCambiarEstadoRecurso: vi.fn(),
  onCambiarOcupacion: vi.fn(),
  ...extra,
});

describe('PanelDetalle: despacho contextual', () => {
  it('sin incidente seleccionado no existe ningún botón DESPACHAR ni lista de unidades', () => {
    render(<PanelDetalle {...base({ incidente: null })} />);
    expect(screen.queryByRole('button', { name: /^Despachar/ })).toBeNull();
    expect(screen.queryByText('DESPACHAR')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Unidades disponibles' })).toBeNull();
    expect(screen.getByText(/Selecciona un incidente/)).toBeTruthy();
  });

  it('con incidente, cada unidad disponible tiene DESPACHAR y llama a la mutación con su incidenteId', async () => {
    const mutar = vi.fn();
    render(<PanelDetalle {...base({ onCambiarEstadoRecurso: mutar })} />);
    const disponibles = screen.getByRole('region', { name: 'Unidades disponibles' });
    expect(within(disponibles).getAllByText('DESPACHAR')).toHaveLength(2);

    await userEvent.click(screen.getByRole('button', { name: 'Despachar M11' }));
    expect(mutar).toHaveBeenCalledTimes(1);
    expect(mutar).toHaveBeenCalledWith(expect.objectContaining({ id: 'M11' }), 'Despachado', 'inc-1-a3f');
  });

  it('las unidades asignadas ofrecen solo transiciones válidas y conservan el incidente', async () => {
    const mutar = vi.fn();
    render(<PanelDetalle {...base({ onCambiarEstadoRecurso: mutar })} />);
    const asignadas = screen.getByRole('region', { name: 'Unidades asignadas' });
    expect(within(asignadas).getByText('U02')).toBeTruthy();
    expect(within(asignadas).queryByText('P01')).toBeNull();
    expect(within(asignadas).queryByText('DESPACHAR')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'En escena U02' }));
    expect(mutar).toHaveBeenCalledWith(expect.objectContaining({ id: 'U02' }), 'En Escena', 'inc-1-a3f');
  });

  it('una unidad inoperativa solo puede habilitarse, nunca despacharse', () => {
    render(<PanelDetalle {...base()} />);
    expect(screen.queryByRole('button', { name: 'Despachar M10' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Liberar M10' })).toBeTruthy();
  });

  it('sin unidades disponibles lo indica', () => {
    render(<PanelDetalle {...base({ recursos: [unidad('M10', 'Inoperativo')] })} />);
    expect(screen.getByText('No hay unidades disponibles')).toBeTruthy();
    expect(screen.getByText('Sin unidades asignadas')).toBeTruthy();
  });
});

describe('PanelDetalle: ficha, bitácora y refugios', () => {
  it('muestra código, título, criticidad, estado y tiempo abierto', () => {
    render(<PanelDetalle {...base()} />);
    expect(screen.getByText('Incidente #A3F')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Fuga de gas en sector' })).toBeTruthy();
    expect(screen.getByText('Crítico')).toBeTruthy();
    expect(screen.getAllByText('Abierto').length).toBeGreaterThan(0);
    expect(screen.getByText(/Abierto hace 30 min/)).toBeTruthy();
  });

  it('cambia el estado del incidente con los otros dos estados posibles', async () => {
    const cambiar = vi.fn();
    render(<PanelDetalle {...base({ onCambiarEstadoIncidente: cambiar })} />);
    expect(screen.queryByRole('button', { name: 'Marcar Abierto' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Marcar Resuelto' }));
    expect(cambiar).toHaveBeenCalledWith(incidente, 'Resuelto');
    expect(screen.getByRole('button', { name: 'Marcar Contenido' })).toBeTruthy();
  });

  it('lista los eventos de la línea de tiempo', () => {
    render(<PanelDetalle {...base()} />);
    const bitacora = screen.getByRole('region', { name: 'Línea de tiempo' });
    expect(within(bitacora).getAllByRole('listitem')).toHaveLength(2);
    expect(bitacora.textContent).toContain('Validado por operador');
  });

  it('los refugios se ajustan con o sin incidente', async () => {
    const ajustar = vi.fn();
    const { rerender } = render(<PanelDetalle {...base({ onCambiarOcupacion: ajustar })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Aumentar ocupación de Coliseo Municipal' }));
    expect(ajustar).toHaveBeenCalledWith(refugio, 5);

    rerender(<PanelDetalle {...base({ incidente: null, onCambiarOcupacion: ajustar })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reducir ocupación de Coliseo Municipal' }));
    expect(ajustar).toHaveBeenCalledWith(refugio, -5);
  });
});
