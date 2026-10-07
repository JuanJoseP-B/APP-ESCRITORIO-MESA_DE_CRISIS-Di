// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Badge } from './Badge';

afterEach(cleanup);

describe('Badge', () => {
  it('severidad crítica = sólido + cuadrado + palabra', () => {
    const { container } = render(<Badge severity="critico" />);
    const el = container.firstElementChild;
    expect(el?.textContent).toBe('Crítico');
    expect(el?.classList.contains('ag-badge--critical')).toBe(true);
    expect(el?.classList.contains('ag-badge--solid')).toBe(true);
    expect(el?.querySelector('.ag-glyph--square')).not.toBeNull();
  });

  it.each([
    ['medio', 'Medio', 'triangle'],
    ['bajo', 'Bajo', 'ring'],
  ] as const)('severidad %s lleva su glifo', (severity, texto, forma) => {
    const { container } = render(<Badge severity={severity} />);
    expect(container.textContent).toBe(texto);
    expect(container.querySelector(`.ag-glyph--${forma}`)).not.toBeNull();
  });

  it('estado de incidente resuelto = círculo', () => {
    const { container } = render(<Badge status="resuelto" />);
    expect(container.textContent).toBe('Resuelto');
    expect(container.querySelector('.ag-glyph--circle')).not.toBeNull();
  });

  it('tono manual con texto propio y sin glifo', () => {
    const { container } = render(
      <Badge tone="success" glyph={false}>
        En línea
      </Badge>,
    );
    expect(screen.getByText('En línea')).toBeTruthy();
    expect(container.querySelector('.ag-glyph')).toBeNull();
  });
});
