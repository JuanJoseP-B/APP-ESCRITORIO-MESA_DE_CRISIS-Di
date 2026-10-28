// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ESPERA_DESHACER_MS, useDescarteDiferido } from './useDescarteDiferido';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useDescarteDiferido', () => {
  it('oculta al momento y confirma pasados 5 s', () => {
    const confirmar = vi.fn();
    const { result } = renderHook(() => useDescarteDiferido<string>(confirmar));
    act(() => result.current.descartar('a'));
    expect(result.current.pendiente).toBe('a');
    act(() => vi.advanceTimersByTime(ESPERA_DESHACER_MS - 1));
    expect(confirmar).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(confirmar).toHaveBeenCalledWith('a');
    expect(result.current.pendiente).toBeNull();
  });

  it('deshacer recupera el elemento y nunca lo confirma', () => {
    const confirmar = vi.fn();
    const { result } = renderHook(() => useDescarteDiferido<string>(confirmar));
    act(() => result.current.descartar('a'));
    act(() => result.current.deshacer());
    expect(result.current.pendiente).toBeNull();
    act(() => vi.advanceTimersByTime(ESPERA_DESHACER_MS * 2));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('un segundo descarte confirma ya el anterior y deja pendiente el nuevo', () => {
    const confirmar = vi.fn();
    const { result } = renderHook(() => useDescarteDiferido<string>(confirmar));
    act(() => result.current.descartar('a'));
    act(() => result.current.descartar('b'));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(confirmar).toHaveBeenCalledWith('a');
    expect(result.current.pendiente).toBe('b');
  });

  it('al desmontar confirma el pendiente para no perder el descarte', () => {
    const confirmar = vi.fn();
    const { result, unmount } = renderHook(() => useDescarteDiferido<string>(confirmar));
    act(() => result.current.descartar('a'));
    unmount();
    expect(confirmar).toHaveBeenCalledWith('a');
  });
});
