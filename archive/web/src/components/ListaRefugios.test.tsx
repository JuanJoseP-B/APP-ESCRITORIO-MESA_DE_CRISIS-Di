// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ZonaPublica } from '@argos/shared';
import { ListaRefugios } from './ListaRefugios';

afterEach(cleanup);

const zona = (id: string, tipo: ZonaPublica['tipo'], actual = 0, maxima = 0): ZonaPublica => ({
  id,
  tipo,
  nombre: `Sitio ${id}`,
  geometria: { type: 'Point', coordinates: [0, 0] },
  capacidad_actual: actual,
  capacidad_maxima: maxima,
});

describe('ListaRefugios', () => {
  it('muestra la ocupación de cada refugio', () => {
    render(<ListaRefugios zonas={[zona('a', 'Refugio', 48, 150)]} />);
    expect(screen.getByText('Sitio a')).toBeTruthy();
    expect(screen.getByText('48/150')).toBeTruthy();
  });

  it('marca como completo un refugio sin cupo', () => {
    render(<ListaRefugios zonas={[zona('a', 'Refugio', 120, 120)]} />);
    expect(screen.getByText('COMPLETO')).toBeTruthy();
  });

  it('separa los bloqueos de vía de los refugios', () => {
    render(<ListaRefugios zonas={[zona('r', 'Refugio', 1, 10), zona('b', 'Bloqueo de Vía')]} />);
    expect(screen.getByText('Refugios seguros (1)')).toBeTruthy();
    expect(screen.getByText('Vías bloqueadas (1)')).toBeTruthy();
  });

  it('informa cuando no hay refugios y muestra errores', () => {
    render(<ListaRefugios zonas={[]} error="Sin conexión" />);
    expect(screen.getByText(/No hay refugios/)).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe('Sin conexión');
  });
});
