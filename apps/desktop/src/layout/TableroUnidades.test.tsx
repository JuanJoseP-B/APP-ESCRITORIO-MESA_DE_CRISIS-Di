// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstadoSla, Recurso } from '@argos/shared';
import { TableroUnidades, type TableroUnidadesProps } from './TableroUnidades';
import css from './TableroUnidades.css?raw';

afterEach(cleanup);

const rec = (id: string, tipo: Recurso['tipo'], etiqueta: string | null, estado: Recurso['estado_actual'], inc: string | null = null): Recurso => ({
  id,
  tipo,
  etiqueta,
  estado_actual: estado,
  incidente_asignado_id: inc,
});

const recursos: readonly Recurso[] = [
  rec('r4', 'Policía', 'P01', 'EN_ESCENA', 'i1'),
  rec('r2', 'Ambulancia', 'M12', 'ASIGNADO', 'i1'),
  rec('r1', 'Bomberos', 'U01', 'DISPONIBLE'),
  rec('r3', 'Ambulancia', 'M10', 'INOPERATIVO'),
];

const base: TableroUnidadesProps = {
  recursos,
  incidenteSeleccionadoId: null,
  onSeleccionarUnidad: vi.fn(),
};

describe('TableroUnidades', () => {
  it('muestra un chip por unidad con su indicativo completo, ordenadas por tipo', () => {
    render(<TableroUnidades {...base} />);
    const lista = screen.getByRole('list', { name: 'Unidades' });
    const nombres = within(lista).getAllByRole('button').map((b) => b.getAttribute('aria-label'));
    expect(nombres).toEqual([
      'U01, Bomberos, Disponible',
      'M10, Ambulancia, Inoperativo',
      'M12, Ambulancia, Despachado',
      'P01, Policía, En escena',
    ]);
  });

  it('cada chip comunica el estado con glifo y palabra', () => {
    const { container } = render(<TableroUnidades {...base} />);
    const estados = [...container.querySelectorAll('.ag-unit__state')].map((e) => e.textContent);
    expect(estados).toEqual(['DISP', 'INOP', 'ASIG', 'ESC']);
    expect(container.querySelectorAll('.ag-unit .ag-glyph').length).toBe(4);
  });

  it('resume cuántas unidades están disponibles', () => {
    render(<TableroUnidades {...base} />);
    expect(screen.getByText('1/4 disp.')).toBeTruthy();
  });

  it('un clic entrega la unidad pulsada', async () => {
    const elegir = vi.fn();
    render(<TableroUnidades {...base} onSeleccionarUnidad={elegir} />);
    await userEvent.click(screen.getByRole('button', { name: /^M12/ }));
    expect(elegir).toHaveBeenCalledWith(expect.objectContaining({ id: 'r2' }));
  });

  it('resalta las unidades asignadas al incidente seleccionado', () => {
    render(<TableroUnidades {...base} incidenteSeleccionadoId="i1" />);
    expect(screen.getByRole('button', { name: /^M12/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^P01/ }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: /^U01/ }).getAttribute('aria-pressed')).toBe('false');
  });

  it('resalta la unidad elegida, aunque no tenga incidente asignado', () => {
    render(<TableroUnidades {...base} unidadSeleccionadaId="r1" />);
    const chip = screen.getByRole('button', { name: /^U01/ });
    expect(chip.getAttribute('aria-pressed')).toBe('true');
    expect(chip.classList.contains('ag-unit--foco')).toBe(true);
    expect(screen.getByRole('button', { name: /^M10/ }).getAttribute('aria-pressed')).toBe('false');
  });

  describe('cronómetros SLA', () => {
    const estado = (recursoId: string, nivel: EstadoSla['nivel'], transcurridoSeg: number): EstadoSla => ({ recursoId, hito: 'EN_ESCENA', transcurridoSeg, limiteSeg: 600, nivel });

    it('solo las unidades con SLA llevan cronómetro, con el nivel en glifo y palabra', () => {
      const sla = new Map([['r2', estado('r2', 'VENCIDO', 612)]]);
      const { container } = render(<TableroUnidades {...base} sla={sla} />);
      const cronometros = container.querySelectorAll('.ag-unit__timer');
      expect(cronometros).toHaveLength(1);
      expect(cronometros[0]?.getAttribute('data-nivel')).toBe('vencido');
      expect(cronometros[0]?.textContent).toBe('10:12vencido');
      expect(cronometros[0]?.querySelector('.ag-glyph--square')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'M12, Ambulancia, Despachado, 10:12, vencido' })).toBeTruthy();
    });

    it('en tiempo es neutro: solo mm:ss', () => {
      const { container } = render(<TableroUnidades {...base} sla={new Map([['r2', estado('r2', 'EN_TIEMPO', 65)]])} />);
      expect(container.querySelector('.ag-unit__timer')?.textContent).toBe('01:05');
      expect(container.querySelector('.ag-unit__timer .ag-glyph')).toBeNull();
    });

    it('reducirMovimiento cambia el parpadeo por el patrón estático', () => {
      const { container } = render(<TableroUnidades {...base} sla={new Map([['r2', estado('r2', 'VENCIDO', 700)]])} reducirMovimiento />);
      expect(container.querySelector('.ag-unit__timer')?.getAttribute('data-movimiento')).toBe('reducido');
    });

    it('sin SLA ninguna unidad lleva cronómetro', () => {
      const { container } = render(<TableroUnidades {...base} />);
      expect(container.querySelector('.ag-unit__timer')).toBeNull();
    });
  });

  it('sin unidades lo indica', () => {
    render(<TableroUnidades {...base} recursos={[]} />);
    expect(screen.getByText('Sin unidades registradas')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Unidades' })).toBeNull();
  });

  it('genera indicativos completos para unidades sin etiqueta', () => {
    render(<TableroUnidades {...base} recursos={[rec('a', 'Bomberos', null, 'DISPONIBLE'), rec('b', 'Bomberos', null, 'DISPONIBLE')]} />);
    expect(screen.getByRole('button', { name: /^B-01/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /^B-02/ })).toBeTruthy();
  });

  it('la fila de chips solo desplaza en horizontal y no usa colores sueltos', () => {
    expect(css).toContain('.ag-tablero__chips');
    expect(css).toMatch(/\.ag-tablero__chips \{[^}]*overflow-x: auto;[^}]*overflow-y: hidden;/);
    expect(css).not.toMatch(/overflow-y: (auto|scroll)/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
