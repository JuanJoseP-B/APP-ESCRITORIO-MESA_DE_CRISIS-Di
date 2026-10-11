// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ContadorRodante } from './ContadorRodante';
import css from './ContadorRodante.css?raw';

afterEach(cleanup);

describe('ContadorRodante', () => {
  it('muestra el valor como un solo texto y sin animación al montarse', () => {
    render(<ContadorRodante valor={45} />);
    expect(screen.getByText('45').className).toBe('ag-rodante__valor');
  });

  it('al subir rueda desde abajo y al bajar desde arriba', () => {
    const { rerender } = render(<ContadorRodante valor={3} />);
    rerender(<ContadorRodante valor={4} />);
    expect(screen.getByText('4').classList.contains('ag-rodante__valor--sube')).toBe(true);
    rerender(<ContadorRodante valor={2} />);
    expect(screen.getByText('2').classList.contains('ag-rodante__valor--baja')).toBe(true);
  });

  it('un nuevo render con el mismo valor no vuelve a animar', () => {
    const { rerender } = render(<ContadorRodante valor="03/10" />);
    rerender(<ContadorRodante valor="04/10" />);
    rerender(<ContadorRodante valor="04/10" />);
    expect(screen.getByText('04/10').className).toBe('ag-rodante__valor');
  });

  it('compara el primer número de un texto con formato (045/200, 23%)', () => {
    const { rerender } = render(<ContadorRodante valor="23%" />);
    rerender(<ContadorRodante valor="9%" />);
    expect(screen.getByText('9%').classList.contains('ag-rodante__valor--baja')).toBe(true);
  });

  it('su duración y su curva salen de los tokens de movimiento', () => {
    expect(css).toContain('var(--dur-base, 240ms)');
    expect(css).toContain('var(--ease-mecanico,');
    expect(css).toContain('tabular-nums');
  });
});
