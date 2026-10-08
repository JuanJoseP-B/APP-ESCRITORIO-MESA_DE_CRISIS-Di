// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DURACION_AVISO_SLA_MS, useAvisosSla } from './useAvisosSla';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const montar = (inicial: readonly string[]) =>
  renderHook(({ vencidas }) => useAvisosSla(vencidas), { initialProps: { vencidas: inicial } });

describe('useAvisosSla', () => {
  it('la primera lectura es la base: lo ya vencido no avisa', () => {
    const { result } = montar(['m12']);
    expect(result.current.avisos).toEqual([]);
  });

  it('avisa una vez por cada vencimiento nuevo', () => {
    const { result, rerender } = montar([]);
    rerender({ vencidas: ['m12'] });
    expect(result.current.avisos).toEqual([{ id: 1, recursoId: 'm12' }]);
    rerender({ vencidas: ['m12'] });
    rerender({ vencidas: ['m12'] });
    expect(result.current.avisos).toHaveLength(1);
    rerender({ vencidas: ['m12', 'u02'] });
    expect(result.current.avisos.map((a) => a.recursoId)).toEqual(['m12', 'u02']);
  });

  it('si la unidad deja de estar vencida y vuelve a vencer, avisa de nuevo', () => {
    const { result, rerender } = montar([]);
    rerender({ vencidas: ['m12'] });
    rerender({ vencidas: [] });
    rerender({ vencidas: ['m12'] });
    expect(result.current.avisos).toHaveLength(2);
  });

  it('cada aviso se retira solo pasado su tiempo', () => {
    const { result, rerender } = montar([]);
    rerender({ vencidas: ['m12'] });
    act(() => void vi.advanceTimersByTime(DURACION_AVISO_SLA_MS - 1));
    expect(result.current.avisos).toHaveLength(1);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current.avisos).toEqual([]);
  });

  it('se puede descartar a mano y no deja temporizadores al desmontar', () => {
    const { result, rerender, unmount } = montar([]);
    rerender({ vencidas: ['m12', 'u02'] });
    act(() => result.current.descartar(1));
    expect(result.current.avisos.map((a) => a.recursoId)).toEqual(['u02']);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
