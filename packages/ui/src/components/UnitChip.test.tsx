// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { UnitChip } from './UnitChip';
import css from './UnitChip.css?raw';

afterEach(cleanup);

describe('UnitChip', () => {
  it('muestra el indicativo completo, el glifo y la palabra del estado', () => {
    const { container } = render(<UnitChip callsign="M-12" status="despachado" />);
    expect(container.querySelector('.ag-unit__callsign')?.textContent).toBe('M-12');
    expect(container.querySelector('.ag-unit__state')?.textContent).toBe('ASIG');
    expect(container.querySelector('.ag-glyph--triangle')).not.toBeNull();
  });

  it.each([
    ['disponible', 'DISP', 'circle'],
    ['despachado', 'ASIG', 'triangle'],
    ['enruta', 'RUTA', 'arrow'],
    ['escena', 'ESC', 'diamond'],
    ['inoperativo', 'INOP', 'ring'],
  ] as const)('%s = palabra %s + glifo %s', (status, palabra, forma) => {
    const { container } = render(<UnitChip callsign="B-01" status={status} />);
    expect(container.querySelector('.ag-unit__state')?.textContent).toBe(palabra);
    expect(container.querySelector(`.ag-glyph--${forma}`)).not.toBeNull();
  });

  it('en ruta se distingue de despachado por forma y palabra, no solo por color', () => {
    const { container } = render(<UnitChip callsign="M-12" status="enruta" kind="Ambulancia" timer="06:12" />);
    expect(container.querySelector('.ag-glyph--triangle')).toBeNull();
    expect(container.querySelector('.ag-glyph--arrow')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'M-12, Ambulancia, En ruta, 06:12' })).toBeTruthy();
  });

  it('el cronómetro es opcional y, si hay nivel, añade glifo y palabra al nombre accesible', () => {
    const { container, rerender } = render(<UnitChip callsign="M-01" status="disponible" />);
    expect(container.querySelector('.ag-unit__timer')).toBeNull();

    rerender(<UnitChip callsign="M-12" status="despachado" kind="Ambulancia" timer="06:12" />);
    expect(container.querySelector('.ag-unit__timer')?.textContent).toBe('06:12');
    expect(container.querySelector('.ag-unit__timer .ag-glyph')).toBeNull();

    rerender(<UnitChip callsign="M-12" status="despachado" kind="Ambulancia" timer="06:12" timerLevel="vencido" />);
    expect(container.querySelector('.ag-unit__timer')?.getAttribute('data-nivel')).toBe('vencido');
    expect(container.querySelector('.ag-unit__timer .ag-glyph--square')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'M-12, Ambulancia, Despachado, 06:12, vencido' })).toBeTruthy();
  });

  it('sin onSelect es informativo; con onSelect es un botón con aria-pressed', async () => {
    const alElegir = vi.fn();
    const { rerender } = render(<UnitChip callsign="P-01" status="escena" />);
    expect(screen.queryByRole('button')).toBeNull();

    rerender(<UnitChip callsign="P-01" status="escena" onSelect={alElegir} selected />);
    const boton = screen.getByRole('button', { name: 'P-01, En escena' });
    expect(boton.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(boton);
    expect(alElegir).toHaveBeenCalledTimes(1);
  });

  it('no usa colores sueltos en su hoja de estilos', () => {
    expect(css).toContain('.ag-unit');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
