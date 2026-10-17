// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

afterEach(cleanup);

describe('Button', () => {
  it('es type=button y ghost/md por defecto', () => {
    render(<Button>Cancelar</Button>);
    const b = screen.getByRole('button', { name: 'Cancelar' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.classList.contains('ag-btn--ghost')).toBe(true);
    expect(b.classList.contains('ag-btn--md')).toBe(true);
  });

  it('aplica variante, tamaño y bloque', () => {
    render(<Button variant="primary" size="lg" block>Despachar</Button>);
    const b = screen.getByRole('button', { name: 'Despachar' });
    expect(['ag-btn--primary', 'ag-btn--lg', 'ag-btn--block'].every((c) => b.classList.contains(c))).toBe(true);
  });

  it('dispara onClick y no lo hace si está deshabilitado', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Ok</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
    rerender(<Button onClick={onClick} disabled>Ok</Button>);
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('marca data-pressed con Enter o Espacio y lo quita al soltar', () => {
    render(<Button variant="primary">Despachar</Button>);
    const b = screen.getByRole('button');
    fireEvent.keyDown(b, { key: 'Enter' });
    expect(b.getAttribute('data-pressed')).toBe('true');
    fireEvent.keyUp(b, { key: 'Enter' });
    expect(b.hasAttribute('data-pressed')).toBe(false);
    fireEvent.keyDown(b, { key: ' ' });
    expect(b.getAttribute('data-pressed')).toBe('true');
    fireEvent.mouseLeave(b);
    expect(b.hasAttribute('data-pressed')).toBe(false);
  });

  it('un botón deshabilitado no recibe data-pressed con el teclado', () => {
    render(<Button disabled>Ok</Button>);
    const b = screen.getByRole('button');
    fireEvent.keyDown(b, { key: 'Enter' });
    expect(b.hasAttribute('data-pressed')).toBe(false);
  });

  it('onClick se dispara una vez con clic y una vez con Enter', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Ok</Button>);
    const b = screen.getByRole('button');
    await userEvent.click(b);
    expect(onClick).toHaveBeenCalledTimes(1);
    onClick.mockClear();
    b.focus();
    await userEvent.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
