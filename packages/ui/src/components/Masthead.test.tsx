// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { Masthead } from './Masthead';

afterEach(cleanup);

describe('Masthead', () => {
  it('muestra la marca y el título por defecto', () => {
    render(<Masthead />);
    expect(screen.getByRole('banner')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Mesa de Crisis');
    expect(screen.getByText('ARGOS')).toBeTruthy();
  });

  it('renderiza kicker, título y acciones propios', () => {
    render(<Masthead kicker="Turno noche" title="Operador" actions={<button type="button">Salir</button>} />);
    expect(screen.getByText('Turno noche')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Operador');
    expect(screen.getByRole('button', { name: 'Salir' })).toBeTruthy();
  });
});
