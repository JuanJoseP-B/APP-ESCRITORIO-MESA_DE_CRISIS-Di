// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ESCENARIOS, TRAFICO_ESCENARIO, type Guion } from '../domain/escenario';
import { crearRelojSimulado } from '../domain/relojSimulado';
import { crearServicioDemo } from '../services/servicioDemo';
import { useSimulacion } from './useSimulacion';

const GUION: Guion = [
  { id: 'a', tSeg: 10, llamada: { canal: '123', tipo: 'FUGA_GAS', prioridad: 'P1', ubicacion: { lat: 1.22, lng: -77.28 }, narrativa: 'A', reportante: null, callback: null } },
  { id: 'b', tSeg: 30, llamada: { canal: 'SENSOR', tipo: 'CRECIENTE_SUBITA', prioridad: 'P2', ubicacion: { lat: 1.21, lng: -77.27 }, narrativa: 'B', reportante: null, callback: null } },
];

const ESCENARIO_PRUEBA = { guion: GUION, retraso: null };

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function montar(enMarcha = true) {
  const reloj = crearRelojSimulado(Date.now, enMarcha);
  const servicio = crearServicioDemo({ ahora: reloj.ahora });
  const registrar = vi.spyOn(servicio, 'registrarLlamada');
  const hook = renderHook(() => useSimulacion(servicio, reloj, ESCENARIO_PRUEBA, 100));
  return { reloj, servicio, registrar, ...hook };
}

describe('useSimulacion', () => {
  it('sin reloj (backend real) no hace nada y devuelve null', () => {
    const servicio = crearServicioDemo();
    const registrar = vi.spyOn(servicio, 'registrarLlamada');
    const { result } = renderHook(() => useSimulacion(servicio, undefined, ESCENARIO_PRUEBA, 100));
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

describe('useSimulacion: retraso de la unidad retenida', () => {
  const notasDe = async (servicio: ReturnType<typeof crearServicioDemo>, incidenteId: string) =>
    ((await servicio.listarIncidentes()).find((i) => i.id === incidenteId)?.timeline ?? []).filter(
      (e) => e.descripcion === TRAFICO_ESCENARIO.nota,
    );
  const avanzar = (ms: number) => act(async () => void vi.advanceTimersByTimeAsync(ms));

  it('anota el retraso en la bitácora del incidente al que va la unidad, una sola vez y firmado por el sistema', async () => {
    const reloj = crearRelojSimulado(Date.now, true);
    const servicio = crearServicioDemo({ ahora: reloj.ahora }); // la M12 ya va EN_RUTA al incidente demo-1
    renderHook(() => useSimulacion(servicio, reloj, ESCENARIOS.A, 1000));
    await avanzar((TRAFICO_ESCENARIO.tSeg - 5) * 1000);
    expect(await notasDe(servicio, 'demo-1')).toHaveLength(0);
    await avanzar(10_000);
    await avanzar(60_000);
    const notas = await notasDe(servicio, 'demo-1');
    expect(notas).toHaveLength(1);
    expect(notas[0]?.autor).toBe('Sistema');
  });

  it('espera a que la unidad retenida salga y entonces anota el retraso en su incidente', async () => {
    const reloj = crearRelojSimulado(Date.now, true);
    const servicio = crearServicioDemo({ ahora: reloj.ahora, escenario: ESCENARIOS.A });
    const incidente = await servicio.crearIncidente({
      titulo: 'Fuga de gas',
      nivel_criticidad: 'Crítico',
      prioridad: 'P1',
      tipo: 'FUGA_GAS',
      estado: 'Abierto',
      geometria: { type: 'Point', coordinates: [-77.2811, 1.2136] },
      timeline: [],
    });
    await servicio.cambiarEstadoRecurso('demo-rec-6', 'ASIGNADO', incidente.id);
    renderHook(() => useSimulacion(servicio, reloj, ESCENARIOS.A, 1000));
    await avanzar((TRAFICO_ESCENARIO.tSeg + 30) * 1000);
    expect(await notasDe(servicio, incidente.id)).toHaveLength(0); // aún no sale: no hay nada que retrasar
    await servicio.cambiarEstadoRecurso('demo-rec-6', 'EN_RUTA', null);
    await avanzar(5_000);
    expect(await notasDe(servicio, incidente.id)).toHaveLength(1);
    await avanzar(30_000);
    expect(await notasDe(servicio, incidente.id)).toHaveLength(1);
  });

  it('un escenario sin unidad retenida no toca la bitácora', async () => {
    const reloj = crearRelojSimulado(Date.now, true);
    const servicio = crearServicioDemo({ ahora: reloj.ahora });
    const actualizar = vi.spyOn(servicio, 'actualizarIncidente');
    renderHook(() => useSimulacion(servicio, reloj, ESCENARIO_PRUEBA, 1000));
    await avanzar(300_000);
    expect(actualizar).not.toHaveBeenCalled();
  });
});
