// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, renderHook } from '@testing-library/react';
import type { Llamada } from '@argos/shared';
import { useOndasRadarLlamadas } from './useOndasRadarLlamadas';

const mocks = vi.hoisted(() => {
  const mockRemove = vi.fn();
  const mockAddTo = vi.fn().mockReturnThis();
  const mockSetLngLat = vi.fn().mockReturnThis();
  return {
    mockRemove,
    mockAddTo,
    mockSetLngLat,
  };
});

vi.mock('maplibre-gl', () => {
  class MockMarker {
    addTo = mocks.mockAddTo;
    setLngLat = mocks.mockSetLngLat;
    remove = mocks.mockRemove;
  }
  return {
    Marker: MockMarker,
  };
});

afterEach(cleanup);

const LLAMADA_BASE: Llamada = {
  id: 'll-1',
  prioridad: 'P1',
  tipo: 'INCENDIO',
  canal: '123',
  narrativa: 'Humo en piso 2',
  reportante: null,
  callback: null,
  operadorId: null,
  ubicacion: { lat: 1.21, lng: -77.28 },
  incidenteId: null,
  estadoValidacion: 'No confirmado',
  creadoEn: new Date(1_000_000).toISOString(),
};

describe('useOndasRadarLlamadas', () => {
  it('añade un marcador con 3 ondas si la llamada es nueva y lo retira con movimiento reducido', () => {
    const mockMapa = {} as never;

    const { rerender } = renderHook(
      ({ reducir }: { reducir: boolean }) =>
        useOndasRadarLlamadas({
          mapa: mockMapa,
          listo: true,
          llamadas: [LLAMADA_BASE],
          ahora: 1_002_000,
          reducirMovimiento: reducir,
        }),
      { initialProps: { reducir: false } },
    );

    expect(mocks.mockAddTo).toHaveBeenCalledWith(mockMapa);
    expect(mocks.mockSetLngLat).toHaveBeenCalledWith([-77.28, 1.21]);

    // Al activar movimiento reducido se retira el marcador
    rerender({ reducir: true });
    expect(mocks.mockRemove).toHaveBeenCalled();
  });
});
