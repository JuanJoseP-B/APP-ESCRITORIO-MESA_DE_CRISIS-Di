// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoRecurso, Incidente, Recurso } from '@argos/shared';
import { duracionTrayectoSeg } from '../domain/movimiento';
import { crearRelojSimulado } from '../domain/relojSimulado';
import { crearServicioDemo } from '../services/servicioDemo';
import { useLlegadaUnidades } from './useLlegadaUnidades';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Demo con U02 (Bomberos, base ≈ 0,4 km del incidente) ya despachada y puesta EN_RUTA. */
async function montar() {
  const reloj = crearRelojSimulado(Date.now, true);
  const servicio = crearServicioDemo({ ahora: reloj.ahora });
  await servicio.cambiarEstadoRecurso('demo-rec-2', 'EN_RUTA', 'demo-1');
  const [recursos, eventos, incidentes] = await Promise.all([
    servicio.listarRecursos(),
    servicio.listarEventosRecurso(),
    servicio.listarIncidentes(),
  ]);
  const estado = { recursos, eventos, incidentes };
  const hook = renderHook(() => useLlegadaUnidades({ servicio, reloj, ...estado, intervaloMs: 100 }));
  return { reloj, servicio, estado, ...hook };
}

const duracionMs = (r: Recurso, i: Incidente): number => {
  const [lng, lat] = i.geometria.type === 'Point' ? i.geometria.coordinates : [0, 0];
  return duracionTrayectoSeg(r.tipo, { origen: r.base ?? { lat: 0, lng: 0 }, destino: { lat: lat ?? 0, lng: lng ?? 0 } }) * 1000;
};

describe('useLlegadaUnidades', () => {
  it('no hace nada antes de que la unidad complete el trayecto', async () => {
    const { servicio, estado } = await montar();
    const cambiar = vi.spyOn(servicio, 'cambiarEstadoRecurso');
    const u02 = estado.recursos.find((r) => r.id === 'demo-rec-2');
    const inc = estado.incidentes[0];
    if (!u02 || !inc) throw new Error('datos del demo');
    act(() => void vi.advanceTimersByTime(duracionMs(u02, inc) / 2));
    expect(cambiar).not.toHaveBeenCalled();
  });

  it('al llegar pasa a EN_ESCENA una sola vez y lo anota en la bitácora', async () => {
    const { servicio, estado } = await montar();
    const cambiar = vi.spyOn(servicio, 'cambiarEstadoRecurso');
    const actualizar = vi.spyOn(servicio, 'actualizarIncidente');
    const u02 = estado.recursos.find((r) => r.id === 'demo-rec-2');
    const inc = estado.incidentes[0];
    if (!u02 || !inc) throw new Error('datos del demo');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(duracionMs(u02, inc) + 1000);
    });
    expect(cambiar).toHaveBeenCalledTimes(1);
    expect(cambiar).toHaveBeenCalledWith('demo-rec-2', 'EN_ESCENA', 'demo-1', 'SISTEMA');
    expect(actualizar).toHaveBeenCalledTimes(1);
    const timeline = actualizar.mock.calls[0]?.[1].timeline ?? [];
    expect(timeline.at(-1)).toMatchObject({ descripcion: 'Unidad U02 llegó a la escena', autor: 'Sistema' });
    const eventos: readonly EventoRecurso[] = await servicio.listarEventosRecurso();
    expect(eventos.at(-1)).toMatchObject({ recursoId: 'demo-rec-2', hacia: 'EN_ESCENA', origen: 'SISTEMA' });
  });

  it('en pausa nadie llega', async () => {
    const { reloj, servicio, estado } = await montar();
    reloj.pausar();
    const cambiar = vi.spyOn(servicio, 'cambiarEstadoRecurso');
    const u02 = estado.recursos.find((r) => r.id === 'demo-rec-2');
    const inc = estado.incidentes[0];
    if (!u02 || !inc) throw new Error('datos del demo');
    await act(async () => {
      await vi.advanceTimersByTimeAsync(duracionMs(u02, inc) * 3);
    });
    expect(cambiar).not.toHaveBeenCalled();
  });
});
