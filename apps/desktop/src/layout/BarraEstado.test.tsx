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
  });

  it('el tema ya no se cambia desde la barra', () => {
    render(<BarraEstado {...base} />);
    expect(screen.queryByRole('button', { name: /turno/i })).toBeNull();
  });

  it('el engranaje abre los ajustes, con nombre accesible y tooltip', async () => {
    const abrir = vi.fn();
    render(<BarraEstado {...base} onAbrirAjustes={abrir} />);
    const boton = screen.getByRole('button', { name: 'Ajustes' });
    expect(boton.getAttribute('title')).toBe('Ajustes');
    expect(boton.querySelector('svg')).not.toBeNull();
    await userEvent.click(boton);
    expect(abrir).toHaveBeenCalledTimes(1);
  });

  it('sin onAbrirAjustes no hay engranaje', () => {
    render(<BarraEstado {...base} />);
    expect(screen.queryByRole('button', { name: 'Ajustes' })).toBeNull();
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

  it('cierra sesión', async () => {
    const salir = vi.fn();
    render(<BarraEstado {...base} onCerrarSesion={salir} />);
    await userEvent.click(screen.getByRole('button', { name: 'Salir' }));
    expect(salir).toHaveBeenCalledTimes(1);
  });

  it('sin onCerrarSesion no hay botón Salir', () => {
    render(<BarraEstado {...base} />);
    expect(screen.queryByRole('button', { name: 'Salir' })).toBeNull();
  });

  it('el contador de entrantes aparece si se informa y cambia de glifo cuando hay llamadas', () => {
    const { rerender, container } = render(<BarraEstado {...base} />);
    expect(screen.queryByText(/Entrantes/)).toBeNull();

    rerender(<BarraEstado {...base} entrantes={0} />);
    expect(screen.getByRole('status', { name: '0 llamadas entrantes' })).toBeTruthy();
    expect(container.querySelector('.ag-glyph--ring')).not.toBeNull();

    rerender(<BarraEstado {...base} entrantes={3} />);
    const contador = screen.getByRole('status', { name: '3 llamadas entrantes' });
    expect(contador.textContent).toContain('3');
    expect(contador.textContent).toContain('Entrantes');
    expect(container.querySelector('.ag-glyph--triangle')).not.toBeNull();
  });

  it('el contador de SLA solo aparece si hay unidades en riesgo, y filtra al pulsarlo o con Enter', async () => {
    const filtrar = vi.fn();
    const { rerender } = render(<BarraEstado {...base} />);
    expect(screen.queryByText('SLA', { exact: false })).toBeNull();

    rerender(<BarraEstado {...base} slaEnRiesgo={0} onFiltrarSla={filtrar} />);
    expect(screen.queryByText('SLA', { exact: false })).toBeNull();

    rerender(<BarraEstado {...base} slaEnRiesgo={2} slaNivel="VENCIDO" onFiltrarSla={filtrar} />);
    const boton = screen.getByRole('button', { name: 'Filtrar la cola por SLA: 2 en alerta o vencidos, nivel vencido' });
    await userEvent.click(boton);
    expect(filtrar).toHaveBeenCalledTimes(1);
    boton.focus();
    await userEvent.keyboard('{Enter}');
    expect(filtrar).toHaveBeenCalledTimes(2);
  });

  it('el nivel más grave da el color, el glifo y la palabra al contador de SLA', () => {
    const { container, rerender } = render(<BarraEstado {...base} slaEnRiesgo={1} slaNivel="ALERTA" />);
    const boton = screen.getByRole('button', { name: /nivel alerta/ });
    expect(boton.className).toContain('text-status-warning');
    expect(boton.querySelector('.ag-glyph--triangle')).not.toBeNull();
    expect(boton.textContent).toContain('1');

    rerender(<BarraEstado {...base} slaEnRiesgo={3} slaNivel="VENCIDO" />);
    const critico = screen.getByRole('button', { name: /nivel vencido/ });
    expect(critico.className).toContain('text-status-critical');
    expect(container.querySelector('.ag-glyph--square')).not.toBeNull();
  });

  it('indica con aria-pressed si el filtro de SLA está activo', () => {
    const { rerender } = render(<BarraEstado {...base} slaEnRiesgo={1} />);
    expect(screen.getByRole('button', { name: /Filtrar la cola por SLA/ }).getAttribute('aria-pressed')).toBe('false');
    rerender(<BarraEstado {...base} slaEnRiesgo={1} filtroSlaActivo />);
    expect(screen.getByRole('button', { name: /Filtrar la cola por SLA/ }).getAttribute('aria-pressed')).toBe('true');
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

  it('antes de iniciar ofrece elegir el escenario A, B o C, marcando el activo', async () => {
    const elegir = vi.fn();
    render(<BarraEstado {...base} simulacion={simulacion({ reproduciendo: false, tSeg: 0, escenario: { actual: 'B', onElegir: elegir } })} />);
    const grupo = screen.getByRole('radiogroup', { name: 'Escenario del demo' });
    expect(grupo).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'B' }).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', { name: 'A' }).getAttribute('aria-checked')).toBe('false');
    expect(screen.getByText('Deslizamiento por lluvias')).toBeTruthy();
    await userEvent.click(screen.getByRole('radio', { name: 'C' }));
    expect(elegir).toHaveBeenCalledWith('C');
  });

  it('una vez iniciado el escenario ya no se puede cambiar', () => {
    render(<BarraEstado {...base} simulacion={simulacion({ reproduciendo: true, tSeg: 30, escenario: { actual: 'A', onElegir: vi.fn() } })} />);
    expect(screen.queryByRole('radiogroup', { name: 'Escenario del demo' })).toBeNull();
    render(<BarraEstado {...base} simulacion={simulacion({ reproduciendo: false, tSeg: 40, escenario: { actual: 'A', onElegir: vi.fn() } })} />);
    expect(screen.queryByRole('radiogroup', { name: 'Escenario del demo' })).toBeNull();
  });

  it('reinicia el escenario', async () => {
    const reiniciar = vi.fn();
    render(<BarraEstado {...base} simulacion={simulacion({ onReiniciar: reiniciar })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(reiniciar).toHaveBeenCalledTimes(1);
  });
});
