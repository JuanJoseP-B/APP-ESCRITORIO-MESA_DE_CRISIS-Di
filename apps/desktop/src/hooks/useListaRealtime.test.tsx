// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { CambioRealtime } from '../domain/realtime';
import { useListaRealtime } from './useListaRealtime';

interface Fila {
  readonly id: string;
  readonly v: number;
}

function montar(inicial: readonly Fila[]) {
  let emitir: (c: CambioRealtime<Fila>) => void = () => undefined;
  const cancelar = vi.fn();
  const cargar = () => Promise.resolve(inicial);
  const suscribir = (cb: (c: CambioRealtime<Fila>) => void) => {
    emitir = cb;
    return cancelar;
  };
  const hook = renderHook(() => useListaRealtime(cargar, suscribir));
  return { hook, cancelar, emitir: (c: CambioRealtime<Fila>) => emitir(c) };
}

describe('useListaRealtime', () => {
  it('carga los datos iniciales', async () => {
    const { hook } = montar([{ id: '1', v: 1 }]);
    expect(hook.result.current.cargando).toBe(true);
    await waitFor(() => expect(hook.result.current.cargando).toBe(false));
    expect(hook.result.current.datos).toEqual([{ id: '1', v: 1 }]);
  });

  it('aplica cambios en tiempo real', async () => {
    const { hook, emitir } = montar([{ id: '1', v: 1 }]);
    await waitFor(() => expect(hook.result.current.cargando).toBe(false));

    act(() => emitir({ tipo: 'INSERT', nuevo: { id: '2', v: 2 }, idEliminado: null }));
    expect(hook.result.current.datos.map((x) => x.id)).toEqual(['1', '2']);
  });

  it('cancela la suscripción al desmontar', async () => {
    const { hook, cancelar } = montar([]);
    await waitFor(() => expect(hook.result.current.cargando).toBe(false));
    hook.unmount();
    expect(cancelar).toHaveBeenCalledOnce();
  });
});
