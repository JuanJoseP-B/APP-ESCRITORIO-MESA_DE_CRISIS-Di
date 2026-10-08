// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRIORIDAD_POR_CRITICIDAD, type EstadoIncidente, type Incidente, type NivelCriticidad, type Llamada, type Recurso } from '@argos/shared';
import { ColaIncidentes, formatearDuracion, type ColaIncidentesProps } from './ColaIncidentes';

afterEach(cleanup);

const AHORA = Date.parse('2026-10-07T12:00:00Z');

const inc = (id: string, nivel: NivelCriticidad, abierto: string, estado: EstadoIncidente = 'Abierto'): Incidente => ({
  id,
  titulo: `Incidente ${id}`,
  nivel_criticidad: nivel,
  prioridad: PRIORIDAD_POR_CRITICIDAD[nivel],
  tipo: 'INCENDIO',
  estado,
  geometria: { type: 'Point', coordinates: [0, 0] },
  timeline: [{ timestamp: abierto, descripcion: 'Registrado' }],
});

const rec = (id: string, incidenteId: string | null): Recurso => ({
  id,
  tipo: 'Bomberos',
  estado_actual: incidenteId ? 'ASIGNADO' : 'DISPONIBLE',
  incidente_asignado_id: incidenteId,
});

const llamada = (id: string, extra: Partial<Llamada> = {}): Llamada => ({
  id,
  canal: '123',
  tipo: 'INCENDIO',
  prioridad: 'P2',
  ubicacion: { lat: 1.2, lng: -77.3 },
  narrativa: '',
  reportante: null,
  callback: null,
  incidenteId: null,
  estadoValidacion: 'No confirmado',
  operadorId: null,
  creadoEn: '2026-10-07T11:50:00Z',
  ...extra,
});

const base: ColaIncidentesProps = {
  incidentes: [
    inc('bajo', 'Bajo', '2026-10-07T11:00:00Z'),
    inc('critico', 'Crítico', '2026-10-07T11:30:00Z'),
    inc('viejo', 'Crítico', '2026-10-07T09:00:00Z'),
    inc('cerrado', 'Medio', '2026-10-07T08:00:00Z', 'Resuelto'),
  ],
  recursos: [rec('r1', 'critico'), rec('r2', 'critico'), rec('r3', null)],
  llamadas: [],
  ahora: AHORA,
  seleccionadoId: null,
  onSeleccionar: vi.fn(),
  onAbrirLlamada: vi.fn(),
};

const filas = () => within(screen.getByRole('list', { name: /Incidentes (activos|cerrados)/ })).getAllByRole('listitem');

describe('formatearDuracion', () => {
  it.each([
    [null, '—'],
    [0, '0 min'],
    [59, '59 min'],
    [60, '1 h 00 min'],
    [125, '2 h 05 min'],
  ])('%s → %s', (minutos, texto) => {
    expect(formatearDuracion(minutos)).toBe(texto);
  });
});

describe('ColaIncidentes', () => {
  it('lista solo los activos, por criticidad y antigüedad, y deja los resueltos fuera', () => {
    render(<ColaIncidentes {...base} />);
    expect(filas().map((f) => f.textContent)).toEqual([
      expect.stringContaining('Incidente viejo'),
      expect.stringContaining('Incidente critico'),
      expect.stringContaining('Incidente bajo'),
    ]);
    expect(screen.queryByText('Incidente cerrado')).toBeNull();
  });

  it('cada fila muestra prioridad (glifo y palabra), código, tiempo abierto y unidades', () => {
    const { container } = render(<ColaIncidentes {...base} />);
    const fila = filas()[1] as HTMLElement; // critico: P1, 30 min, 2 unidades
    expect(fila.textContent).toContain('P1');
    expect(fila.textContent).toContain('#ICO');
    expect(fila.textContent).toContain('30 min');
    expect(fila.textContent).toContain('2 U');
    expect(container.querySelector('.ag-glyph--square')).not.toBeNull();
    expect(filas()[2]?.textContent).toContain('0 U');
  });

  it('la prioridad P1–P4 lleva su color semántico: P1 crítico, P2 advertencia, P3 información, P4 neutro', () => {
    const conPrioridad = (id: string, prioridad: Incidente['prioridad']): Incidente => ({ ...inc(id, 'Medio', '2026-10-07T11:00:00Z'), prioridad });
    const { container } = render(
      <ColaIncidentes {...base} incidentes={(['P1', 'P2', 'P3', 'P4'] as const).map((p) => conPrioridad(`i-${p}`, p))} recursos={[]} />,
    );
    expect(filas().map((f) => f.querySelector('.ag-badge')?.className)).toEqual([
      expect.stringContaining('ag-badge--critical'),
      expect.stringContaining('ag-badge--warning'),
      expect.stringContaining('ag-badge--info'),
      expect.stringContaining('ag-badge--neutral'),
    ]);
    expect(filas().map((f) => f.textContent?.match(/P[1-4]/)?.[0])).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(container.querySelector('.ag-badge--solid')).not.toBeNull();
  });

  it('el badge ☎ N cuenta las llamadas vinculadas y no aparece sin ellas', () => {
    const vinculada = (id: string, incidenteId: string) => llamada(id, { incidenteId, estadoValidacion: 'Confirmado' });
    render(<ColaIncidentes {...base} llamadas={[vinculada('a', 'critico'), vinculada('b', 'critico'), vinculada('c', 'viejo'), llamada('e')]} />);
    const [viejo, critico, bajo] = filas() as [HTMLElement, HTMLElement, HTMLElement];
    expect(within(critico).getByRole('img', { name: '2 llamadas vinculadas' }).textContent).toBe('☎ 2');
    expect(within(viejo).getByRole('img', { name: '1 llamada vinculada' })).toBeTruthy();
    expect(within(bajo).queryByRole('img')).toBeNull();
  });

  it('elegir una fila llama a onSeleccionar con su id y marca la seleccionada', async () => {
    const alElegir = vi.fn();
    const { rerender } = render(<ColaIncidentes {...base} onSeleccionar={alElegir} />);
    await userEvent.click(screen.getByRole('button', { name: /Incidente critico/ }));
    expect(alElegir).toHaveBeenCalledWith('critico');

    rerender(<ColaIncidentes {...base} onSeleccionar={alElegir} seleccionadoId="critico" />);
    expect(screen.getByRole('button', { name: /Incidente critico/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /Incidente bajo/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('la pestaña Cerrados muestra los resueltos, atenuados, y se puede volver a Activos', async () => {
    render(<ColaIncidentes {...base} />);
    expect(screen.getByRole('tab', { name: /Activos \(3\)/ }).getAttribute('aria-selected')).toBe('true');
    await userEvent.click(screen.getByRole('tab', { name: /Cerrados \(1\)/ }));
    expect(screen.getByRole('tab', { name: /Cerrados/ }).getAttribute('aria-selected')).toBe('true');
    expect(filas()).toHaveLength(1);
    expect(filas()[0]?.textContent).toContain('Incidente cerrado');
    expect(filas()[0]?.textContent).toContain('Resuelto');
    expect(filas()[0]?.querySelector('.text-text-muted')).not.toBeNull();

    await userEvent.click(screen.getByRole('tab', { name: /Activos/ }));
    expect(filas()).toHaveLength(3);
  });

  it('muestra un mensaje cuando no hay incidentes', () => {
    render(<ColaIncidentes {...base} incidentes={[]} />);
    expect(screen.getByText('Sin incidentes activos')).toBeTruthy();
  });
});

describe('bandeja de llamadas entrantes en la cola', () => {
  const conLlamadas: ColaIncidentesProps = {
    ...base,
    llamadas: [llamada('abc'), llamada('vinculada', { incidenteId: 'critico', estadoValidacion: 'Confirmado' })],
  };

  it('va encima de los incidentes y lista solo las llamadas sin vincular', () => {
    render(<ColaIncidentes {...conLlamadas} />);
    const bandeja = screen.getByRole('region', { name: 'Bandeja de llamadas entrantes' });
    expect(within(bandeja).getAllByRole('listitem')).toHaveLength(1);
    expect(bandeja.compareDocumentPosition(screen.getByRole('tablist', { name: 'Incidentes' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('abre y descarta la llamada elegida', async () => {
    const abrir = vi.fn();
    const descartar = vi.fn();
    render(<ColaIncidentes {...conLlamadas} onAbrirLlamada={abrir} onDescartarLlamada={descartar} />);
    await userEvent.click(screen.getByRole('button', { name: /Abrir llamada 123, Incendio/ }));
    await userEvent.click(screen.getByRole('button', { name: /Descartar llamada 123/ }));
    expect(abrir).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }));
    expect(descartar).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc' }));
  });
});
