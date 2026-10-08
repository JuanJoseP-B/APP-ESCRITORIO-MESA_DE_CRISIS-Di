// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { StatusIndicator } from './StatusIndicator';

afterEach(cleanup);

describe('StatusIndicator', () => {
  it.each([
    ['disponible', 'Disponible', 'circle'],
    ['despachado', 'Despachado', 'triangle'],
    ['enruta', 'En ruta', 'arrow'],
    ['escena', 'En escena', 'diamond'],
    ['inoperativo', 'Inoperativo', 'ring'],
  ] as const)('%s = glifo + palabra', (status, palabra, forma) => {
    const { container } = render(<StatusIndicator status={status} />);
    expect(container.textContent).toBe(palabra);
    expect(container.querySelector(`.ag-glyph--${forma}`)).not.toBeNull();
  });

  it('muestra el conteo', () => {
    const { container } = render(<StatusIndicator status="disponible" count={4} />);
    expect(container.textContent).toBe('Disponible(4)');
  });

  it('con glyphOnly conserva la palabra solo para lectores de pantalla', () => {
    const { container } = render(<StatusIndicator status="escena" glyphOnly count={2} />);
    expect(container.querySelector('.ag-sr-only')?.textContent).toBe('En escena');
    expect(container.querySelector('.ag-status__count')).toBeNull();
  });
});
