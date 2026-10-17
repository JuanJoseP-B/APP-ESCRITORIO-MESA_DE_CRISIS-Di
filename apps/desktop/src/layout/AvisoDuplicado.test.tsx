// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { CandidatoDuplicado } from '@argos/shared';
import { AvisoDuplicado, type AvisoDuplicadoProps } from './AvisoDuplicado';

afterEach(cleanup);

const candidato = (codigo: string, distanciaM: number, minutosDesde: number): CandidatoDuplicado => ({
  incidenteId: `inc-${codigo}`,
  codigo,
  distanciaM,
  minutosDesde,
  puntaje: 0.8,
});

const props = (extra: Partial<AvisoDuplicadoProps> = {}): AvisoDuplicadoProps => ({
  candidatos: [candidato('A3F', 120, 4)],
  onVincular: vi.fn(),
  onResaltar: vi.fn(),
  ...extra,
});

describe('AvisoDuplicado', () => {
  it('sin candidatos no pinta nada', () => {
    render(<AvisoDuplicado {...props({ candidatos: [] })} />);
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('cada candidato muestra su código, la distancia y los minutos', () => {
    render(<AvisoDuplicado {...props({ candidatos: [candidato('A3F', 120, 4), candidato('B7C', 1250, 0)] })} />);
    const filas = within(screen.getByRole('region', { name: 'Posibles duplicados' })).getAllByRole('listitem');
    expect(filas).toHaveLength(2);
    expect(filas[0]?.textContent).toContain('Posible duplicado de #A3F');
    expect(filas[0]?.textContent).toContain('120 m, hace 4 min');
    expect(filas[1]?.textContent).toContain('#B7C');
    expect(filas[1]?.textContent).toContain('1.3 km, hace menos de 1 min');
  });

  it('el título cuenta los candidatos y lleva glifo y palabra', () => {
    const { container, rerender } = render(<AvisoDuplicado {...props()} />);
    expect(screen.getByRole('heading').textContent).toBe('Posible duplicado');
    expect(container.querySelector('.ag-glyph--triangle')).not.toBeNull();
    rerender(<AvisoDuplicado {...props({ candidatos: [candidato('A3F', 10, 1), candidato('B7C', 20, 2), candidato('C8D', 30, 3)] })} />);
    expect(screen.getByRole('heading').textContent).toBe('3 posibles duplicados');
  });

  it('VINCULAR entrega el candidato elegido', async () => {
    const vincular = vi.fn();
    render(<AvisoDuplicado {...props({ candidatos: [candidato('A3F', 120, 4), candidato('B7C', 200, 6)], onVincular: vincular })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Vincular a #B7C' }));
    expect(vincular).toHaveBeenCalledWith(expect.objectContaining({ incidenteId: 'inc-B7C' }));
  });

  it('resalta el incidente al pasar el cursor y lo suelta al salir', async () => {
    const resaltar = vi.fn();
    render(<AvisoDuplicado {...props({ onResaltar: resaltar })} />);
    const fila = screen.getByRole('listitem');
    await userEvent.hover(fila);
    expect(resaltar).toHaveBeenLastCalledWith('inc-A3F');
    await userEvent.unhover(fila);
    expect(resaltar).toHaveBeenLastCalledWith(null);
  });

  it('resalta también con el foco del teclado y lo suelta al salir de la fila', async () => {
    const resaltar = vi.fn();
    render(<AvisoDuplicado {...props({ candidatos: [candidato('A3F', 120, 4), candidato('B7C', 200, 6)], onResaltar: resaltar })} />);
    await userEvent.tab();
    expect(resaltar).toHaveBeenLastCalledWith('inc-A3F');
    await userEvent.tab();
    expect(resaltar).toHaveBeenLastCalledWith('inc-B7C');
  });

  it('al desaparecer el aviso no deja nada resaltado', () => {
    const resaltar = vi.fn();
    const { rerender, unmount } = render(<AvisoDuplicado {...props({ onResaltar: resaltar })} />);
    resaltar.mockClear();
    rerender(<AvisoDuplicado {...props({ candidatos: [], onResaltar: resaltar })} />);
    expect(resaltar).toHaveBeenCalledWith(null);
    resaltar.mockClear();
    unmount();
    expect(resaltar).toHaveBeenCalledWith(null);
  });

  it('deshabilitado bloquea VINCULAR', () => {
    render(<AvisoDuplicado {...props({ deshabilitado: true })} />);
    expect((screen.getByRole('button', { name: /Vincular/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
