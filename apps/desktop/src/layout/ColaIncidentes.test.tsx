// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PRIORIDAD_POR_CRITICIDAD, type EstadoIncidente, type Incidente, type NivelCriticidad, type Recurso, type Reporte } from '@argos/shared';
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

const reporte = (id: string, estado: Reporte['estado_validacion'] = 'No confirmado'): Reporte => ({
  id,
  tipo: 'INCENDIO',
  lat: 1.2,
  lng: -77.3,
  imagen_url: null,
  estado_validacion: estado,
  creado_en: '2026-10-07T11:50:00Z',
});

const base: ColaIncidentesProps = {
  incidentes: [
    inc('bajo', 'Bajo', '2026-10-07T11:00:00Z'),
    inc('critico', 'Crítico', '2026-10-07T11:30:00Z'),
    inc('viejo', 'Crítico', '2026-10-07T09:00:00Z'),
    inc('cerrado', 'Medio', '2026-10-07T08:00:00Z', 'Resuelto'),
  ],
  recursos: [rec('r1', 'critico'), rec('r2', 'critico'), rec('r3', null)],
  reportes: [],
  ahora: AHORA,
  seleccionadoId: null,
  onSeleccionar: vi.fn(),
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

  it('cada fila muestra criticidad (glifo y palabra), código, tiempo abierto y unidades', () => {
    const { container } = render(<ColaIncidentes {...base} />);
    const fila = filas()[1] as HTMLElement; // critico: 30 min, 2 unidades
    expect(fila.textContent).toContain('Crítico');
    expect(fila.textContent).toContain('#ICO');
    expect(fila.textContent).toContain('30 min');
    expect(fila.textContent).toContain('2 U');
    expect(container.querySelector('.ag-glyph--square')).not.toBeNull();
    expect(filas()[2]?.textContent).toContain('0 U');
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

describe('bandeja de llamadas entrantes', () => {
  const conReportes: ColaIncidentesProps = {
    ...base,
    reportes: [reporte('abc12345-0000'), reporte('zzz99999-0000', 'Confirmado')],
  };

  it('lista solo las llamadas por confirmar, con su contador', () => {
    render(<ColaIncidentes {...conReportes} />);
    const bandeja = screen.getByRole('region', { name: 'Bandeja de llamadas entrantes' });
    expect(within(bandeja).getByText(/1 por confirmar/)).toBeTruthy();
    expect(within(bandeja).getAllByRole('listitem')).toHaveLength(1);
    expect(bandeja.textContent).toContain('#ABC12345');
  });

  it('confirma, descarta y centra el mapa en la llamada elegida', async () => {
    const confirmar = vi.fn();
    const descartar = vi.fn();
    const elegir = vi.fn();
    render(
      <ColaIncidentes
        {...conReportes}
        onConfirmarReporte={confirmar}
        onDescartarReporte={descartar}
        onSeleccionarReporte={elegir}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar reporte abc12345-0000' }));
    await userEvent.click(screen.getByRole('button', { name: 'Descartar reporte abc12345-0000' }));
    await userEvent.click(screen.getByRole('button', { name: 'Ver reporte abc12345-0000 en el mapa' }));
    expect(confirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc12345-0000' }));
    expect(descartar).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc12345-0000' }));
    expect(elegir).toHaveBeenCalledWith(expect.objectContaining({ id: 'abc12345-0000' }));
  });

  it('se pliega y se despliega', async () => {
    render(<ColaIncidentes {...conReportes} />);
    const alternar = screen.getByRole('button', { name: 'Plegar' });
    expect(alternar.getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(alternar);
    expect(screen.queryByRole('button', { name: /Ver reporte/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Desplegar' }).getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar' }));
    expect(screen.getByRole('button', { name: /Ver reporte/ })).toBeTruthy();
  });

  it('sin llamadas pendientes lo indica', () => {
    render(<ColaIncidentes {...base} />);
    expect(screen.getByText('Sin llamadas pendientes')).toBeTruthy();
  });
});
