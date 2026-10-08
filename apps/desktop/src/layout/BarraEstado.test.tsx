// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BarraEstado, type BarraEstadoProps, type SimulacionBarra } from './BarraEstado';

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

describe('BarraEstado: simulación (modo demo)', () => {
  const simulacion = (extra: Partial<SimulacionBarra> = {}): SimulacionBarra => ({
    reproduciendo: true,
    velocidad: 1,
    tSeg: 125,
    duracionSeg: 480,
    onAlternar: vi.fn(),
    onVelocidad: vi.fn(),
    onReiniciar: vi.fn(),
    ...extra,
  });

  it('sin simulación (backend real) no hay controles', () => {
    render(<BarraEstado {...base} />);
    expect(screen.queryByRole('group', { name: 'Simulación del escenario' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reiniciar' })).toBeNull();
  });

  it('muestra el tiempo del escenario y la acción de pausar mientras corre', () => {
    render(<BarraEstado {...base} simulacion={simulacion()} />);
    const grupo = screen.getByRole('group', { name: 'Simulación del escenario' });
    expect(grupo.textContent).toContain('02:05 / 08:00');
    expect(screen.getByRole('button', { name: /Pausar/ })).toBeTruthy();
  });

  it('con el escenario sin iniciar (t=0, en pausa) destaca INICIAR ESCENARIO', async () => {
    const alternar = vi.fn();
    render(<BarraEstado {...base} simulacion={simulacion({ reproduciendo: false, tSeg: 0, onAlternar: alternar })} />);
    expect(screen.queryByRole('button', { name: /Reproducir/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /Iniciar escenario/i }));
    expect(alternar).toHaveBeenCalledTimes(1);
  });

  it('pausado a mitad del escenario no vuelve a ofrecer iniciar', () => {
    render(<BarraEstado {...base} simulacion={simulacion({ reproduciendo: false, tSeg: 40 })} />);
    expect(screen.queryByRole('button', { name: /Iniciar escenario/i })).toBeNull();
    expect(screen.getByRole('button', { name: /Reproducir/ })).toBeTruthy();
  });

  it('en pausa ofrece reproducir', async () => {
    const alternar = vi.fn();
    render(<BarraEstado {...base} simulacion={simulacion({ reproduciendo: false, onAlternar: alternar })} />);
    await userEvent.click(screen.getByRole('button', { name: /Reproducir/ }));
    expect(alternar).toHaveBeenCalledTimes(1);
  });

  it('marca la velocidad activa y permite elegir otra', async () => {
    const velocidad = vi.fn();
    render(<BarraEstado {...base} simulacion={simulacion({ velocidad: 5, onVelocidad: velocidad })} />);
    expect(screen.getByRole('button', { name: 'Velocidad 5×' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Velocidad 1×' }).getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Velocidad 10×' }));
    expect(velocidad).toHaveBeenCalledWith(10);
  });

  it('reinicia el escenario', async () => {
    const reiniciar = vi.fn();
    render(<BarraEstado {...base} simulacion={simulacion({ onReiniciar: reiniciar })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(reiniciar).toHaveBeenCalledTimes(1);
  });
});
