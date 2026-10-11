// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MotorAsesor, RecomendacionAsesor, ResultadoAsesor, SnapshotAsesor } from '@argos/shared';
import { ESPERA_ANALISIS_MS, useAsesor } from './useAsesor';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const snapshot: SnapshotAsesor = {
  version: 1,
  generadoEn: '2026-10-07T12:00:00.000Z',
  incidente: {
    id: 'inc-1',
    codigo: 'IN1',
    tipo: 'FUGA_GAS',
    prioridad: 'P1',
    ubicacion: { lat: 1.2, lng: -77.2 },
    descripcion: 'Fuga',
    llamadasVinculadas: 1,
    minutosAbierto: 3,
    perimetroActual: null,
  },
  recursos: [{ id: 'u01', indicativo: 'U01', tipo: 'Bomberos', estado: 'DISPONIBLE', incidenteId: null, ubicacion: { lat: 1.2, lng: -77.2 }, distanciaM: 100 }],
  refugios: [],
  contexto: { slaVencidos: [], unidadesEnZonaCaliente: [] },
};

const recomendacion: RecomendacionAsesor = {
  idRecomendacion: 'rec-1',
  unidades: [{ idRecurso: 'u01', rol: 'Control', etaMin: 1 }],
  justificacion: 'Texto.',
  perimetroSugerido: { CALIENTE: 100, TIBIA: 300, EVACUACION: 800 },
  refugioSugeridoId: null,
  advertencias: [],
  confianza: 'MEDIA',
};

const motorCon = (resultado: ResultadoAsesor | (() => Promise<ResultadoAsesor>)): MotorAsesor & { recomendar: ReturnType<typeof vi.fn> } => ({
  recomendar: vi.fn(typeof resultado === 'function' ? resultado : () => Promise.resolve(resultado)),
});

const montar = (motor: MotorAsesor, construir: () => SnapshotAsesor | null = () => snapshot) =>
  renderHook(({ id }: { id: string | null }) => useAsesor({ motor, incidenteId: id, construir }), { initialProps: { id: 'inc-1' as string | null } });

const avanzar = (ms: number) => act(() => vi.advanceTimersByTimeAsync(ms));

describe('useAsesor', () => {
  it('empieza inactivo y no consulta al motor hasta que se abre', () => {
    const motor = motorCon({ ok: true, recomendacion });
    const { result } = montar(motor);
    expect(result.current.estado).toEqual({ fase: 'inactivo' });
    expect(motor.recomendar).not.toHaveBeenCalled();
  });

  it('al abrir pasa a «analizando» durante unos 600 ms y luego muestra la recomendación', async () => {
    expect(ESPERA_ANALISIS_MS).toBe(600);
    const motor = motorCon({ ok: true, recomendacion });
    const { result } = montar(motor);
    act(() => result.current.abrir());
    expect(result.current.estado).toEqual({ fase: 'analizando' });
    await avanzar(ESPERA_ANALISIS_MS - 1);
    expect(result.current.estado.fase).toBe('analizando');
    await avanzar(1);
    expect(result.current.estado).toEqual({ fase: 'listo', snapshot, recomendacion });
    expect(motor.recomendar).toHaveBeenCalledWith(snapshot);
  });

  it('un error del motor se muestra como error y no como recomendación', async () => {
    const { result } = montar(motorCon({ ok: false, error: 'SIN_RECOMENDACION', detalle: 'sin tipo' }));
    act(() => result.current.abrir());
    await avanzar(ESPERA_ANALISIS_MS);
    expect(result.current.estado).toEqual({ fase: 'error', error: 'SIN_RECOMENDACION', detalle: 'sin tipo' });
  });

  it('si el motor lanza una excepción, el error es de la API y la consola sigue en pie', async () => {
    const { result } = montar(motorCon(() => Promise.reject(new Error('se cayó'))));
    act(() => result.current.abrir());
    await avanzar(ESPERA_ANALISIS_MS);
    expect(result.current.estado).toEqual({ fase: 'error', error: 'API', detalle: 'se cayó' });
  });

  it('una recomendación que no pasa la validación se descarta como respuesta inválida', async () => {
    const mala = { ...recomendacion, unidades: [{ idRecurso: 'fantasma', rol: 'x', etaMin: 1 }] };
    const { result } = montar(motorCon({ ok: true, recomendacion: mala }));
    act(() => result.current.abrir());
    await avanzar(ESPERA_ANALISIS_MS);
    expect(result.current.estado).toEqual({ fase: 'error', error: 'RESPUESTA_INVALIDA', detalle: 'RECURSO_INEXISTENTE: fantasma' });
  });

  it('cerrar mientras analiza descarta la respuesta que llegue después', async () => {
    const { result } = montar(motorCon({ ok: true, recomendacion }));
    act(() => result.current.abrir());
    act(() => result.current.cerrar());
    await avanzar(ESPERA_ANALISIS_MS * 2);
    expect(result.current.estado).toEqual({ fase: 'inactivo' });
  });

  it('abrir otra vez descarta la consulta anterior', async () => {
    const motor = motorCon({ ok: true, recomendacion });
    const { result } = montar(motor);
    act(() => result.current.abrir());
    await avanzar(300);
    act(() => result.current.abrir());
    await avanzar(300);
    expect(result.current.estado.fase).toBe('analizando');
    await avanzar(300);
    expect(result.current.estado.fase).toBe('listo');
    expect(motor.recomendar).toHaveBeenCalledTimes(2);
  });

  it('alternar abre y cierra', async () => {
    const { result } = montar(motorCon({ ok: true, recomendacion }));
    act(() => result.current.alternar());
    await avanzar(ESPERA_ANALISIS_MS);
    expect(result.current.estado.fase).toBe('listo');
    act(() => result.current.alternar());
    expect(result.current.estado).toEqual({ fase: 'inactivo' });
  });

  it('sin snapshot (no hay incidente) no abre nada', () => {
    const motor = motorCon({ ok: true, recomendacion });
    const { result } = montar(motor, () => null);
    act(() => result.current.abrir());
    expect(result.current.estado).toEqual({ fase: 'inactivo' });
    expect(motor.recomendar).not.toHaveBeenCalled();
  });

  describe('al cambiar el motor (idioma)', () => {
    const conMotor = (motor: MotorAsesor) =>
      renderHook(({ m }: { m: MotorAsesor }) => useAsesor({ motor: m, incidenteId: 'inc-1', construir: () => snapshot }), {
        initialProps: { m: motor },
      });
    const nueva: RecomendacionAsesor = { ...recomendacion, idRecomendacion: 'rec-2', justificacion: 'Text.' };

    it('con la tarjeta abierta la recomendación se recalcula con el motor nuevo', async () => {
      const viejo = motorCon({ ok: true, recomendacion });
      const nuevo = motorCon({ ok: true, recomendacion: nueva });
      const { result, rerender } = conMotor(viejo);
      act(() => result.current.abrir());
      await avanzar(ESPERA_ANALISIS_MS);
      expect(result.current.estado).toEqual({ fase: 'listo', snapshot, recomendacion });

      rerender({ m: nuevo });
      expect(result.current.estado.fase).toBe('analizando');
      await avanzar(ESPERA_ANALISIS_MS);
      expect(result.current.estado).toEqual({ fase: 'listo', snapshot, recomendacion: nueva });
      expect(nuevo.recomendar).toHaveBeenCalledTimes(1);
    });

    it('con la tarjeta cerrada no consulta nada', async () => {
      const nuevo = motorCon({ ok: true, recomendacion: nueva });
      const { result, rerender } = conMotor(motorCon({ ok: true, recomendacion }));
      rerender({ m: nuevo });
      await avanzar(ESPERA_ANALISIS_MS);
      expect(result.current.estado).toEqual({ fase: 'inactivo' });
      expect(nuevo.recomendar).not.toHaveBeenCalled();
    });
  });

  it('al cambiar de incidente la tarjeta se cierra', async () => {
    const { result, rerender } = montar(motorCon({ ok: true, recomendacion }));
    act(() => result.current.abrir());
    await avanzar(ESPERA_ANALISIS_MS);
    expect(result.current.estado.fase).toBe('listo');
    rerender({ id: 'inc-2' });
    expect(result.current.estado).toEqual({ fase: 'inactivo' });
  });
});
