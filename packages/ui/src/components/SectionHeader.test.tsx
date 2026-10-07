// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { SectionHeader } from './SectionHeader';

afterEach(cleanup);

describe('SectionHeader', () => {
  it('renderiza índice, título y conteo dentro de un h2', () => {
    render(<SectionHeader index="01" title="Incidentes" count={3} />);
    const h = screen.getByRole('heading', { level: 2 });
    expect(h.textContent).toBe('01Incidentes· 3');
  });

  it('admite h3 y una acción', () => {
    render(<SectionHeader as="h3" title="Recursos" action={<button type="button">Nuevo</button>} />);
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe('Recursos');
    expect(screen.getByRole('button', { name: 'Nuevo' })).toBeTruthy();
  });
});
