// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from './Switch';
import css from './Switch.css?raw';

afterEach(cleanup);

const base = { label: 'Texto grande', onLabel: 'Activado', offLabel: 'Desactivado', onChange: () => {} };

describe('Switch', () => {
  it('expone el rol switch con su nombre y estado', () => {
    const { rerender } = render(<Switch {...base} checked={false} />);
    const control = screen.getByRole('switch', { name: 'Texto grande' });
    expect(control.getAttribute('aria-checked')).toBe('false');
    expect(control.textContent).toBe('Desactivado');
    rerender(<Switch {...base} checked />);
    expect(control.getAttribute('aria-checked')).toBe('true');
    expect(control.textContent).toBe('Activado');
  });

  it('la ayuda describe el control', () => {
    render(<Switch {...base} checked={false} hint="Aumenta el texto" />);
    const control = screen.getByRole('switch');
    expect(control.getAttribute('aria-describedby')).toBe(screen.getByText('Aumenta el texto').id);
  });

  it('el clic, Espacio y Enter alternan el valor', async () => {
    const alCambiar = vi.fn();
    render(<Switch {...base} checked={false} onChange={alCambiar} />);
    const control = screen.getByRole('switch');
    await userEvent.click(control);
    expect(alCambiar).toHaveBeenLastCalledWith(true);
    control.focus();
    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');
    expect(alCambiar).toHaveBeenCalledTimes(3);
  });

  it('deshabilitado no cambia', async () => {
    const alCambiar = vi.fn();
    render(<Switch {...base} checked={false} disabled onChange={alCambiar} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(alCambiar).not.toHaveBeenCalled();
  });

  it('no usa colores sueltos en su hoja de estilos', () => {
    expect(css).toContain('.ag-switch');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
