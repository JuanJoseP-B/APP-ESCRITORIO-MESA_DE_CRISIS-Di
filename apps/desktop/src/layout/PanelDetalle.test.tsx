// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstadoSla, Incidente, Recurso, ZonaPublica } from '@argos/shared';
import { RADIOS_POR_DEFECTO } from '@argos/shared';
import { analizarPerimetro } from '../domain/analisisEspacial';
import { generarAnillos } from '../domain/perimetro';
import { PanelDetalle, type PanelDetalleProps } from './PanelDetalle';

afterEach(cleanup);

const incidente: Incidente = {
  id: 'inc-1-a3f',
  titulo: 'Fuga de gas en sector',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'FUGA_GAS',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [0, 0] },
  timeline: [
    { timestamp: '2026-10-07T11:40:00Z', descripcion: 'Validado por operador', autor: 'operador@argos.test' },
    { timestamp: '2026-10-07T11:30:00Z', descripcion: 'Incidente registrado' },
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
  unidad('U01', 'DISPONIBLE'),
  unidad('M11', 'DISPONIBLE'),
  unidad('U02', 'ASIGNADO', incidente.id),
  unidad('P01', 'EN_ESCENA', 'otro-incidente'),
  unidad('M10', 'INOPERATIVO'),
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
    expect(mutar).toHaveBeenCalledWith(expect.objectContaining({ id: 'M11' }), 'ASIGNADO', 'inc-1-a3f');
  });

  it('las unidades asignadas ofrecen solo transiciones válidas y conservan el incidente', async () => {
    const mutar = vi.fn();
    render(<PanelDetalle {...base({ onCambiarEstadoRecurso: mutar })} />);
    const asignadas = screen.getByRole('region', { name: 'Unidades asignadas' });
    expect(within(asignadas).getByText('U02')).toBeTruthy();
    expect(within(asignadas).queryByText('P01')).toBeNull();
    expect(within(asignadas).queryByText('DESPACHAR')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'En ruta U02' }));
    expect(mutar).toHaveBeenCalledWith(expect.objectContaining({ id: 'U02' }), 'EN_RUTA', 'inc-1-a3f');
    expect(screen.queryByRole('button', { name: 'En escena U02' })).toBeNull();
  });

  it('una unidad en ruta ofrece En escena y la liberación cancela el despacho', async () => {
    const mutar = vi.fn();
    render(<PanelDetalle {...base({ recursos: [unidad('U03', 'EN_RUTA', 'inc-1-a3f')], onCambiarEstadoRecurso: mutar })} />);
    await userEvent.click(screen.getByRole('button', { name: 'En escena U03' }));
    expect(mutar).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'U03' }), 'EN_ESCENA', 'inc-1-a3f');
    await userEvent.click(screen.getByRole('button', { name: 'Liberar U03' }));
    expect(mutar).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'U03' }), 'DISPONIBLE', 'inc-1-a3f');
  });

  it('una unidad inoperativa solo puede habilitarse, nunca despacharse', () => {
    render(<PanelDetalle {...base()} />);
    expect(screen.queryByRole('button', { name: 'Despachar M10' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Liberar M10' })).toBeTruthy();
  });

  it('sin unidades disponibles lo indica', () => {
    render(<PanelDetalle {...base({ recursos: [unidad('M10', 'INOPERATIVO')] })} />);
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

  it('la línea de tiempo va en orden cronológico, con separador de fecha y autor de cada evento', () => {
    render(<PanelDetalle {...base()} />);
    const bitacora = screen.getByRole('region', { name: 'Línea de tiempo' });
    const items = within(bitacora).getAllByRole('listitem');
    expect(items).toHaveLength(3); // fecha + 2 eventos
    expect(items[0]?.querySelector('time')?.getAttribute('datetime')).toMatch(/^2026-10-0[78]$/);
    expect(items[1]?.textContent).toContain('Incidente registrado');
    expect(items[1]?.textContent).toContain('sin autor');
    expect(items[2]?.textContent).toContain('Validado por operador');
    expect(items[2]?.textContent).toContain('operador@argos.test');
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

describe('PanelDetalle: despacho con teclado', () => {
  it('el botón «Despachar unidad» muestra su tecla D en un <kbd>, anuncia el atajo y abre el despacho', async () => {
    const abrir = vi.fn();
    render(<PanelDetalle {...base({ onAbrirDespacho: abrir })} />);
    const boton = screen.getByRole('button', { name: 'Despachar unidad' });
    expect(boton.querySelector('kbd')?.textContent).toBe('D');
    expect(boton.getAttribute('aria-keyshortcuts')).toBe('D');
    await userEvent.click(boton);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('no aparece sin la acción o con el incidente resuelto', () => {
    const { rerender } = render(<PanelDetalle {...base()} />);
    expect(screen.queryByRole('button', { name: 'Despachar unidad' })).toBeNull();
    rerender(<PanelDetalle {...base({ incidente: { ...incidente, estado: 'Resuelto' }, onAbrirDespacho: vi.fn() })} />);
    expect(screen.queryByRole('button', { name: 'Despachar unidad' })).toBeNull();
  });
});

describe('PanelDetalle: cronómetros SLA', () => {
  const sla = (recursoId: string, nivel: EstadoSla['nivel'], transcurridoSeg: number): EstadoSla => ({ recursoId, hito: 'EN_RUTA', transcurridoSeg, limiteSeg: 120, nivel });

  it('las unidades asignadas muestran su cronómetro con nivel en glifo y palabra', () => {
    render(<PanelDetalle {...base({ sla: new Map([['U02', sla('U02', 'ALERTA', 100)]]) })} />);
    const asignadas = screen.getByRole('region', { name: 'Unidades asignadas' });
    const cronometro = within(asignadas).getByRole('timer', { name: '01:40, alerta' });
    expect(cronometro.getAttribute('data-nivel')).toBe('alerta');
    expect(cronometro.querySelector('.ag-glyph--triangle')).not.toBeNull();
  });

  it('sin SLA, o en unidades libres, no hay cronómetro', () => {
    render(<PanelDetalle {...base()} />);
    expect(screen.queryByRole('timer')).toBeNull();
  });
});

describe('PanelDetalle: análisis del perímetro', () => {
  const anillos = generarAnillos({ lat: 0, lng: 0 }, RADIOS_POR_DEFECTO);

  it('sin perímetro no hay sección de análisis', () => {
    render(<PanelDetalle {...base()} />);
    expect(screen.queryByRole('region', { name: 'Análisis del perímetro' })).toBeNull();
  });

  it('con perímetro muestra el análisis justo después de la ficha y pasa el resaltado al mapa', async () => {
    const onResaltar = vi.fn();
    const analisis = analizarPerimetro(anillos, [refugio], []);
    render(<PanelDetalle {...base({ perimetro: { anillos, analisis }, onResaltar })} />);
    const secciones = screen.getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(secciones.slice(0, 2)).toEqual(['Ficha del incidente', 'Análisis del perímetro']);
    await userEvent.hover(screen.getByText(/^Coliseo Municipal · /));
    expect(onResaltar).toHaveBeenLastCalledWith({ tipo: 'zona', id: 'z1' });
  });
});
