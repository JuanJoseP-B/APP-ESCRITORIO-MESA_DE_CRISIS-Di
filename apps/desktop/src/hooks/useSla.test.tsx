// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { EventoRecurso, Incidente, Recurso } from '@argos/shared';
import { useSla } from './useSla';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const T0 = Date.parse('2026-10-08T10:00:00Z');
const recursos: Recurso[] = [{ id: 'r1', tipo: 'Ambulancia', estado_actual: 'ASIGNADO', incidente_asignado_id: 'i1' }];
const eventos: EventoRecurso[] = [
  { id: 'e1', recursoId: 'r1', incidenteId: 'i1', desde: 'DISPONIBLE', hacia: 'ASIGNADO', origen: 'MANUAL', creadoEn: new Date(T0).toISOString() },
];
const incidentes = [{ id: 'i1', prioridad: 'P1' }] as unknown as Incidente[];

describe('useSla', () => {
  it('recalcula cada segundo sobre el reloj inyectado, sin consultar nada', () => {
    let ahora = T0 + 90_000;
    const { result } = renderHook(() => useSla(recursos, eventos, incidentes, 0, () => ahora));
    expect(result.current.porRecurso.get('r1')).toMatchObject({ nivel: 'EN_TIEMPO', transcurridoSeg: 90 });
    expect(result.current.resumen).toMatchObject({ vencidos: 0, alertas: 0 });

    ahora = T0 + 100_000;
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.porRecurso.get('r1')?.nivel).toBe('ALERTA');
    expect(result.current.resumen).toMatchObject({ alertas: 1, nivel: 'ALERTA' });

    ahora = T0 + 121_000;
    act(() => void vi.advanceTimersByTime(1000));
    expect(result.current.porRecurso.get('r1')?.nivel).toBe('VENCIDO');
    expect(result.current.resumen).toMatchObject({ vencidos: 1, nivel: 'VENCIDO' });
  });

  it('no repinta entre un segundo y otro', () => {
    let ahora = T0;
    const { result } = renderHook(() => useSla(recursos, eventos, incidentes, 0, () => ahora));
    const primero = result.current;
    ahora = T0 + 500;
    act(() => void vi.advanceTimersByTime(500));
    expect(result.current).toBe(primero);
  });

  it('aplica el desfase del servidor y se detiene al desmontar', () => {
    const { result, unmount } = renderHook(() => useSla(recursos, eventos, incidentes, 30_000, () => T0 + 60_000));
    expect(result.current.porRecurso.get('r1')?.transcurridoSeg).toBe(90);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
