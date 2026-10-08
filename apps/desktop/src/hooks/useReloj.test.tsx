// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useReloj } from './useReloj';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useReloj', () => {
  it('devuelve la hora local corregida por el desfase del servidor', () => {
    const ahora = vi.fn(() => 10_000);
    const { result } = renderHook(() => useReloj(4_000, 1000, ahora));
    expect(result.current).toBe(14_000);
  });

  it('avanza cada segundo con el reloj inyectado', () => {
    let t = 1_000;
    const ahora = () => t;
    const { result } = renderHook(() => useReloj(0, 1000, ahora));
    expect(result.current).toBe(1_000);

    t = 2_000;
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current).toBe(2_000);

    t = 5_000;
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current).toBe(5_000);
  });

  it('recalcula de inmediato cuando llega un desfase nuevo', () => {
    const ahora = () => 10_000;
    const { result, rerender } = renderHook(({ desfase }) => useReloj(desfase, 1000, ahora), {
      initialProps: { desfase: 0 },
    });
    expect(result.current).toBe(10_000);
    rerender({ desfase: -2_500 });
    expect(result.current).toBe(7_500);
  });

  it('deja de actualizar al desmontar (sin temporizadores colgados)', () => {
    const { unmount } = renderHook(() => useReloj(0, 1000, () => 0));
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
