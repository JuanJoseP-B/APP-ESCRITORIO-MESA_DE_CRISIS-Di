// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarraEstado, type BarraEstadoProps } from './BarraEstado';

afterEach(cleanup);

const HORA = Date.UTC(2026, 9, 7, 22, 15, 7);
const base: BarraEstadoProps = {
  hora: HORA,
  zona: 'America/Bogota',
  turno: 'carbon',
  onAlternarTurno: vi.fn(),
  operador: 'operador@argos.test',
  enlace: 'EN_VIVO',
};

describe('BarraEstado', () => {
  it('muestra el reloj con segundos, la zona, el turno y el operador', () => {
    render(<BarraEstado {...base} />);
    const reloj = screen.getByText('17:15:07');
    expect(reloj.tagName).toBe('TIME');
    expect(reloj.getAttribute('datetime')).toBe('2026-10-07T22:15:07.000Z');
    expect(screen.getByText('UTC-5')).toBeTruthy();
    expect(screen.getByText(/Turno Noche/).textContent).toContain('operador@argos.test');
  });

  it('el turno de día aparece con el tema crema', () => {
    render(<BarraEstado {...base} turno="crema" />);
    expect(screen.getByText(/Turno Día/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Turno noche' })).toBeTruthy();
  });

  it.each([
    ['EN_VIVO', 'En vivo', 'circle'],
    ['CONECTANDO', 'Conectando', 'diamond'],
    ['SIN_ENLACE', 'Sin enlace', 'square'],
  ] as const)('el enlace %s se comunica con glifo y palabra', (enlace, palabra, forma) => {
    const { container } = render(<BarraEstado {...base} enlace={enlace} />);
    const estado = screen.getByRole('status');
    expect(estado.textContent).toBe(palabra);
    expect(estado.getAttribute('aria-label')).toBe(`Enlace: ${palabra}`);
    expect(container.querySelector(`.ag-glyph--${forma}`)).not.toBeNull();
  });

  it('alterna el turno y cierra sesión', async () => {
    const alternar = vi.fn();
    const salir = vi.fn();
    render(<BarraEstado {...base} onAlternarTurno={alternar} onCerrarSesion={salir} />);
    await userEvent.click(screen.getByRole('button', { name: 'Turno día' }));
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(alternar).toHaveBeenCalledTimes(1);
    expect(salir).toHaveBeenCalledTimes(1);
  });

  it('sin onCerrarSesion no hay botón Salir', () => {
    render(<BarraEstado {...base} />);
    expect(screen.queryByRole('button', { name: 'Salir' })).toBeNull();
  });

  it('el contador de SLA solo aparece si se informa, y filtra al pulsarlo', async () => {
    const filtrar = vi.fn();
    const { rerender } = render(<BarraEstado {...base} />);
    expect(screen.queryByText('SLA', { exact: false })).toBeNull();

    rerender(<BarraEstado {...base} slaVencidos={2} onFiltrarSla={filtrar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Filtrar cola: 2 SLA vencidos' }));
    expect(filtrar).toHaveBeenCalledTimes(1);

    rerender(<BarraEstado {...base} slaVencidos={0} onFiltrarSla={filtrar} />);
    expect((screen.getByRole('button', { name: 'Filtrar cola: 0 SLA vencidos' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
