// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Llamada } from '@argos/shared';
import type { ReproductorSonidos } from '../services/reproductorSonidos';
import { useSonidosConsola } from './useSonidosConsola';

afterEach(cleanup);

const llamada = (id: string, prioridad: Llamada['prioridad']) => ({ id, prioridad }) as Llamada;

function montar(entrantes: readonly Llamada[], listo: boolean) {
  const salida: ReproductorSonidos = { activar: vi.fn(), configurar: vi.fn(), reproducir: vi.fn() };
  const hook = renderHook(
    (p: { entrantes: readonly Llamada[]; listo: boolean }) => useSonidosConsola({ ...p, unidadesVencidas: [], recursos: [], incidentes: [] }, salida),
    { initialProps: { entrantes, listo } },
  );
  return { salida, hook };
}

describe('useSonidosConsola', () => {
  it('lo que llega con la carga inicial no suena; la llamada siguiente sí, según su prioridad', () => {
    const inicial = [llamada('l1', 'P1')];
    const { salida, hook } = montar([], false);
    hook.rerender({ entrantes: inicial, listo: false });
    hook.rerender({ entrantes: inicial, listo: true });
    expect(salida.reproducir).not.toHaveBeenCalled();

    hook.rerender({ entrantes: [...inicial, llamada('l2', 'P2')], listo: true });
    expect(salida.reproducir).toHaveBeenCalledTimes(1);
    expect(salida.reproducir).toHaveBeenCalledWith('llamadaP2');
  });
});
