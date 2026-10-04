// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useGeolocalizacion } from './useGeolocalizacion';

afterEach(() => {
  vi.unstubAllGlobals();
});

function simularGeolocalizacion(getCurrentPosition: unknown) {
  vi.stubGlobal('navigator', { geolocation: { getCurrentPosition } });
}

describe('useGeolocalizacion', () => {
  it('comienza inactivo y no pide ubicación por sí solo', () => {
    const getCurrentPosition = vi.fn();
    simularGeolocalizacion(getCurrentPosition);
    const { result } = renderHook(() => useGeolocalizacion());
    expect(result.current.resultado).toEqual({ estado: 'inactivo' });
    expect(getCurrentPosition).not.toHaveBeenCalled();
  });

  it('entrega las coordenadas al obtener la posición', () => {
    simularGeolocalizacion((ok: PositionCallback) =>
      ok({ coords: { latitude: -33.4, longitude: -70.6 } } as GeolocationPosition),
    );
    const { result } = renderHook(() => useGeolocalizacion());
    act(() => result.current.solicitar());
    expect(result.current.resultado).toEqual({ estado: 'ok', coordenadas: { lat: -33.4, lng: -70.6 } });
  });

  it('informa permiso denegado en español', () => {
    simularGeolocalizacion((_ok: PositionCallback, error: PositionErrorCallback) =>
      error({ code: 1, PERMISSION_DENIED: 1, POSITION_UNAVAILABLE: 2, TIMEOUT: 3 } as GeolocationPositionError),
    );
    const { result } = renderHook(() => useGeolocalizacion());
    act(() => result.current.solicitar());
    expect(result.current.resultado).toMatchObject({ estado: 'error', mensaje: expect.stringContaining('denegado') });
  });

  it('informa cuando el navegador no soporta geolocalización', () => {
    vi.stubGlobal('navigator', {});
    const { result } = renderHook(() => useGeolocalizacion());
    act(() => result.current.solicitar());
    expect(result.current.resultado).toMatchObject({ estado: 'error', mensaje: expect.stringContaining('no admite') });
  });
});
