// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Guion } from '../domain/escenario';
import { crearRelojSimulado } from '../domain/relojSimulado';
import { crearServicioDemo } from '../services/servicioDemo';
import { useSimulacion } from './useSimulacion';

const GUION: Guion = [
  { id: 'a', tSeg: 10, llamada: { canal: '123', tipo: 'FUGA_GAS', prioridad: 'P1', ubicacion: { lat: 1.22, lng: -77.28 }, narrativa: 'A', reportante: null, callback: null } },
  { id: 'b', tSeg: 30, llamada: { canal: 'SENSOR', tipo: 'CRECIENTE_SUBITA', prioridad: 'P2', ubicacion: { lat: 1.21, lng: -77.27 }, narrativa: 'B', reportante: null, callback: null } },
];

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function montar(enMarcha = true) {
  const reloj = crearRelojSimulado(Date.now, enMarcha);
  const servicio = crearServicioDemo({ ahora: reloj.ahora });
  const registrar = vi.spyOn(servicio, 'registrarLlamada');
  const hook = renderHook(() => useSimulacion(servicio, reloj, GUION, 100));
  return { reloj, servicio, registrar, ...hook };
}

describe('useSimulacion', () => {
  it('sin reloj (backend real) no hace nada y devuelve null', () => {
    const servicio = crearServicioDemo();
    const registrar = vi.spyOn(servicio, 'registrarLlamada');
    const { result } = renderHook(() => useSimulacion(servicio, undefined, GUION, 100));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(result.current).toBeNull();
    expect(registrar).not.toHaveBeenCalled();
  });

  it('el escenario arranca en pausa: no inyecta nada hasta que se inicia', () => {
    const { registrar, result } = montar(false);
    act(() => void vi.advanceTimersByTime(60_000));
    expect(registrar).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({ reproduciendo: false, tSeg: 0 });
    act(() => result.current?.alternar());
    act(() => void vi.advanceTimersByTime(11_000));
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('inyecta cada llamada del guion una sola vez, por el servicio y en su momento', () => {
    const { registrar } = montar();
    act(() => void vi.advanceTimersByTime(9_000));
    expect(registrar).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(2_000));
    expect(registrar).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenLastCalledWith(GUION[0]!.llamada);
    act(() => void vi.advanceTimersByTime(30_000));
    expect(registrar).toHaveBeenCalledTimes(2);
    expect(registrar).toHaveBeenLastCalledWith(GUION[1]!.llamada);
  });

  it('a 10× el guion corre diez veces más rápido', () => {
    const { registrar, result } = montar();
    act(() => result.current?.fijarVelocidad(10));
    act(() => void vi.advanceTimersByTime(3_500));
    expect(registrar).toHaveBeenCalledTimes(2);
    expect(result.current?.velocidad).toBe(10);
  });

  it('en pausa no inyecta ni avanza el tiempo, y al reanudar continúa', () => {
    const { registrar, result } = montar();
    act(() => void vi.advanceTimersByTime(5_000));
    act(() => result.current?.alternar());
    expect(result.current?.reproduciendo).toBe(false);
    act(() => void vi.advanceTimersByTime(120_000));
    expect(registrar).not.toHaveBeenCalled();
    expect(Math.round(result.current?.tSeg ?? -1)).toBe(5);
    act(() => result.current?.alternar());
    act(() => void vi.advanceTimersByTime(6_000));
    expect(registrar).toHaveBeenCalledTimes(1);
  });

  it('las llamadas inyectadas llegan a los suscriptores como las reales', async () => {
    const { servicio } = montar();
    const alCambiar = vi.fn();
    servicio.suscribirLlamadas(alCambiar);
    await act(async () => void vi.advanceTimersByTime(11_000));
    expect(alCambiar).toHaveBeenCalledWith(
      expect.objectContaining({ tipo: 'INSERT', nuevo: expect.objectContaining({ narrativa: 'A', estadoValidacion: 'No confirmado' }) }),
    );
  });

  it('acota el tiempo mostrado a la duración del escenario', () => {
    const { result } = montar();
    act(() => result.current?.fijarVelocidad(10));
    act(() => void vi.advanceTimersByTime(120_000));
    expect(result.current?.tSeg).toBe(result.current?.duracionSeg);
  });
});
