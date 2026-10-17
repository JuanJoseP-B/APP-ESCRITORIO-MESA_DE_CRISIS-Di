import { describe, expect, it } from 'vitest';
import type { Llamada, Prioridad } from '@argos/shared';
import { VENTANA_NUEVA_MS, entrantes, esLlamadaNueva, llamadasPorIncidente, reporteDeLlamada, segundosDesde } from './entrantes';

const AHORA = Date.parse('2026-10-08T12:00:00Z');
const hace = (seg: number): string => new Date(AHORA - seg * 1000).toISOString();

const llamada = (id: string, prioridad: Prioridad, seg: number, extra: Partial<Llamada> = {}): Llamada => ({
  id,
  canal: '123',
  tipo: 'FUGA_GAS',
  prioridad,
  ubicacion: { lat: 1.22, lng: -77.28 },
  narrativa: '',
  reportante: null,
  callback: null,
  incidenteId: null,
  estadoValidacion: 'No confirmado',
  operadorId: null,
  creadoEn: hace(seg),
  ...extra,
});

describe('entrantes', () => {
  it('deja solo las llamadas sin vincular ni descartar', () => {
    const lista = [
      llamada('a', 'P2', 10),
      llamada('vinculada', 'P1', 10, { incidenteId: 'i1', estadoValidacion: 'Confirmado' }),
      llamada('descartada', 'P1', 10, { estadoValidacion: 'Descartado' }),
    ];
    expect(entrantes(lista).map((l) => l.id)).toEqual(['a']);
  });

  it('ordena por prioridad y, a igual prioridad, la más reciente arriba', () => {
    const lista = [llamada('p2-vieja', 'P2', 300), llamada('p1-vieja', 'P1', 200), llamada('p2-nueva', 'P2', 5), llamada('p1-nueva', 'P1', 20)];
    expect(entrantes(lista).map((l) => l.id)).toEqual(['p1-nueva', 'p1-vieja', 'p2-nueva', 'p2-vieja']);
  });

  it('no modifica la lista recibida', () => {
    const lista = [llamada('b', 'P3', 50), llamada('a', 'P1', 50)];
    entrantes(lista);
    expect(lista.map((l) => l.id)).toEqual(['b', 'a']);
  });
});

describe('tiempos de la bandeja', () => {
  it('cuenta los segundos desde que entró y no baja de cero', () => {
    expect(segundosDesde(llamada('a', 'P1', 42), AHORA)).toBe(42);
    expect(segundosDesde(llamada('a', 'P1', -5), AHORA)).toBe(0);
  });

  it('una llamada es nueva solo durante la ventana de resaltado', () => {
    expect(esLlamadaNueva(llamada('a', 'P1', 0), AHORA)).toBe(true);
    expect(esLlamadaNueva(llamada('a', 'P1', VENTANA_NUEVA_MS / 1000 - 1), AHORA)).toBe(true);
    expect(esLlamadaNueva(llamada('a', 'P1', VENTANA_NUEVA_MS / 1000), AHORA)).toBe(false);
    expect(esLlamadaNueva(llamada('a', 'P1', 600), AHORA)).toBe(false);
  });
});

describe('reporteDeLlamada', () => {
  it('conserva id, tipo, ubicación y estado', () => {
    expect(reporteDeLlamada(llamada('a', 'P1', 5))).toMatchObject({
      id: 'a',
      tipo: 'FUGA_GAS',
      lat: 1.22,
      lng: -77.28,
      estado_validacion: 'No confirmado',
    });
  });
});

describe('llamadasPorIncidente', () => {
  it('cuenta las llamadas vinculadas a cada incidente y no las entrantes ni las descartadas', () => {
    const vinculada = (id: string, incidenteId: string, extra: Partial<Llamada> = {}) =>
      llamada(id, 'P1', 10, { incidenteId, estadoValidacion: 'Confirmado', ...extra });
    const cuenta = llamadasPorIncidente([
      vinculada('a', 'i1'),
      vinculada('b', 'i1'),
      vinculada('c', 'i2'),
      vinculada('d', 'i2', { estadoValidacion: 'Descartado' }),
      llamada('entrante', 'P2', 5),
    ]);
    expect(cuenta.get('i1')).toBe(2);
    expect(cuenta.get('i2')).toBe(1);
    expect(cuenta.size).toBe(2);
  });
});
