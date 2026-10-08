// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SegmentedControl } from './SegmentedControl';
import css from './SegmentedControl.css?raw';

afterEach(cleanup);

const OPCIONES = [
  { value: 'a', label: 'Alfa' },
  { value: 'b', label: 'Beta' },
  { value: 'c', label: 'Gamma' },
] as const;

describe('SegmentedControl', () => {
  it('es un grupo de radio con nombre y una sola opción marcada', () => {
    render(<SegmentedControl label="Tema" options={OPCIONES} value="b" onChange={() => {}} />);
    expect(screen.getByRole('radiogroup', { name: 'Tema' })).toBeTruthy();
    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: 'Beta' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'Alfa' }).getAttribute('aria-checked')).toBe('false');
  });

  it('la elegida se distingue por glifo además del color; solo ella entra en el orden de tabulación', () => {
    const { container } = render(<SegmentedControl label="Tema" options={OPCIONES} value="a" onChange={() => {}} />);
    expect(screen.getByRole('radio', { name: 'Alfa' }).querySelector('.ag-glyph--circle')).not.toBeNull();
    expect(screen.getByRole('radio', { name: 'Beta' }).querySelector('.ag-glyph--ring')).not.toBeNull();
    expect(container.querySelectorAll('[tabindex="0"]')).toHaveLength(1);
  });

  it('un clic elige la opción', async () => {
    const alCambiar = vi.fn();
    render(<SegmentedControl label="Tema" options={OPCIONES} value="a" onChange={alCambiar} />);
    await userEvent.click(screen.getByRole('radio', { name: 'Gamma' }));
    expect(alCambiar).toHaveBeenCalledWith('c');
  });

  it('las flechas mueven la elección y el foco, con vuelta al principio y al final', async () => {
    const alCambiar = vi.fn();
    render(<SegmentedControl label="Tema" options={OPCIONES} value="c" onChange={alCambiar} />);
    screen.getByRole('radio', { name: 'Gamma' }).focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(alCambiar).toHaveBeenLastCalledWith('a');
    expect(document.activeElement).toBe(screen.getByRole('radio', { name: 'Alfa' }));
    await userEvent.keyboard('{ArrowLeft}');
    expect(alCambiar).toHaveBeenLastCalledWith('c');
  });

  it('no usa colores sueltos en su hoja de estilos', () => {
    expect(css).toContain('.ag-seg');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
