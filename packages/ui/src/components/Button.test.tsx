// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
});
