// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { LeyendaMapa } from './LeyendaMapa';

afterEach(cleanup);

describe('LeyendaMapa', () => {
  it('lista las capas del mapa, cada una con glifo y palabra', () => {
    const { container } = render(<LeyendaMapa />);
    const items = within(screen.getByRole('region', { name: 'Leyenda del mapa' })).getAllByRole('listitem');
    expect(items.map((i) => i.textContent)).toEqual([
      'Incidente crítico',
      'Incidente medio',
      'Incidente bajo',
      'Refugio',
      'Bloqueo de vía',
      'Llamada sin confirmar',
    ]);
    expect(container.querySelectorAll('li .ag-glyph')).toHaveLength(items.length);
  });

  it('la criticidad no depende solo del color: cada nivel usa una forma distinta', () => {
    const { container } = render(<LeyendaMapa />);
    const formas = [...container.querySelectorAll('li')]
      .slice(0, 3)
      .map((li) => [...(li.querySelector('.ag-glyph')?.classList ?? [])].find((c) => c.startsWith('ag-glyph--')));
    expect(new Set(formas).size).toBe(3);
  });

  it('usa clases semánticas de estado, sin colores sueltos ni transparencias', () => {
    const { container } = render(<LeyendaMapa />);
    const clases = container.innerHTML;
    expect(clases).toContain('text-status-critical');
    expect(clases).toContain('text-status-warning');
    expect(clases).toContain('text-status-success');
    expect(clases).not.toMatch(/bg-\[|text-\[|backdrop-blur|\/\d+"/);
  });
});
