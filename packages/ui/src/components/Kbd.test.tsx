// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Button } from './Button';
import { Kbd } from './Kbd';
import css from './Kbd.css?raw';

afterEach(cleanup);

describe('Kbd', () => {
  it('es un elemento <kbd> con la tecla', () => {
    const { container } = render(<Kbd>Ctrl+Enter</Kbd>);
    const tecla = container.querySelector('kbd');
    expect(tecla?.textContent).toBe('Ctrl+Enter');
    expect(tecla?.classList.contains('ag-kbd')).toBe(true);
  });

  it('no altera el nombre accesible del botón que lo contiene', () => {
    render(
      <Button aria-keyshortcuts="D">
        Despachar <Kbd>D</Kbd>
      </Button>,
    );
    expect(screen.getByRole('button', { name: 'Despachar' }).getAttribute('aria-keyshortcuts')).toBe('D');
  });

  it('con decorative=false la tecla se lee: ya no se oculta', () => {
    const { container } = render(<Kbd decorative={false}>F1</Kbd>);
    expect(container.querySelector('kbd')?.hasAttribute('aria-hidden')).toBe(false);
    expect(screen.getByText('F1')).toBeTruthy();
  });

  it('es sutil: contorno fino, sin relleno, sin opacidad ni colores sueltos', () => {
    expect(css).toContain('background: transparent');
    expect(css).toContain('color: inherit');
    expect(css).not.toMatch(/opacity/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
