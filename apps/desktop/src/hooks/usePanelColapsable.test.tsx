// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePanelColapsable } from './usePanelColapsable';

afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('usePanelColapsable', () => {
  it('arranca expandido por defecto y acepta un estado inicial', () => {
    expect(renderHook(() => usePanelColapsable('cola')).result.current.colapsado).toBe(false);
    expect(renderHook(() => usePanelColapsable('detalle', true)).result.current.colapsado).toBe(true);
  });

  it('alterna, colapsa y expande', () => {
    const { result } = renderHook(() => usePanelColapsable('cola'));
    act(() => result.current.alternar());
    expect(result.current.colapsado).toBe(true);
    act(() => result.current.alternar());
    expect(result.current.colapsado).toBe(false);
    act(() => result.current.colapsar());
    act(() => result.current.colapsar());
    expect(result.current.colapsado).toBe(true);
    act(() => result.current.expandir());
    expect(result.current.colapsado).toBe(false);
  });

  it('recuerda el estado entre sesiones, por panel', () => {
    const primera = renderHook(() => usePanelColapsable('cola'));
    act(() => primera.result.current.colapsar());
    primera.unmount();

    expect(renderHook(() => usePanelColapsable('cola')).result.current.colapsado).toBe(true);
    expect(renderHook(() => usePanelColapsable('detalle')).result.current.colapsado).toBe(false);
  });

  it('el valor guardado prevalece sobre el inicial; uno inválido se ignora', () => {
    localStorage.setItem('argos.panel.cola', 'expandido');
    expect(renderHook(() => usePanelColapsable('cola', true)).result.current.colapsado).toBe(false);
    localStorage.setItem('argos.panel.cola', 'raro');
    expect(renderHook(() => usePanelColapsable('cola', true)).result.current.colapsado).toBe(true);
  });

  it('funciona sin almacenamiento disponible', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    const { result } = renderHook(() => usePanelColapsable('cola'));
    expect(result.current.colapsado).toBe(false);
    act(() => result.current.alternar());
    expect(result.current.colapsado).toBe(true);
  });

  it('las funciones devueltas son estables entre renders', () => {
    const { result, rerender } = renderHook(() => usePanelColapsable('cola'));
    const { alternar, colapsar, expandir } = result.current;
    rerender();
    expect(result.current.alternar).toBe(alternar);
    expect(result.current.colapsar).toBe(colapsar);
    expect(result.current.expandir).toBe(expandir);
  });
});
