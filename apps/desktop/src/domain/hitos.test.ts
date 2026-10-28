import { describe, expect, it } from 'vitest';
import type { EventoRecurso, Incidente, Llamada } from '@argos/shared';
import { hitosDeIncidente } from './hitos';

const T = (min: number) => new Date(Date.UTC(2026, 9, 7, 18, min)).toISOString();

const incidente = (estado: Incidente['estado'] = 'Abierto', timeline: Incidente['timeline'] = []): Incidente => ({
  id: 'inc-1',
  titulo: 'Fuga de gas',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'FUGA_GAS',
  estado,
  geometria: { type: 'Point', coordinates: [0, 0] },
  timeline,
  creado_en: T(24),
});

const llamada = (id: string, min: number, incidenteId: string | null = 'inc-1'): Llamada => ({
  id,
  canal: '123',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: { lat: 0, lng: 0 },
  narrativa: '',
  reportante: null,
  callback: null,
  incidenteId,
  estadoValidacion: 'Confirmado',
  operadorId: null,
  creadoEn: T(min),
});

const evento = (hacia: EventoRecurso['hacia'], min: number, recursoId = 'u01', incidenteId: string | null = 'inc-1'): EventoRecurso => ({
  id: `${recursoId}-${hacia}-${min}`,
  recursoId,
  incidenteId,
  desde: 'DISPONIBLE',
  hacia,
  origen: 'MANUAL',
  creadoEn: T(min),
});

const estados = (h: ReturnType<typeof hitosDeIncidente>) => h.map((x) => `${x.hito}:${x.estado}`);

describe('hitosDeIncidente', () => {
  it('recién creado desde una llamada: la llamada hecha, el incidente es el actual y el resto pendiente', () => {
    const h = hitosDeIncidente(incidente(), [llamada('l1', 23)], []);
    expect(estados(h)).toEqual([
      'LLAMADA:hecho',
      'CREADO:actual',
      'DESPACHADA:pendiente',
      'EN_RUTA:pendiente',
      'EN_ESCENA:pendiente',
      'CONTENIDO:pendiente',
      'RESUELTO:pendiente',
    ]);
    expect(h[0]?.canal).toBe('123');
    expect(h[0]?.ms).toBe(Date.parse(T(23)));
    expect(h[1]?.ms).toBe(Date.parse(T(24)));
  });

  it('una unidad en ruta es el hito actual y lleva su id; toma el primer evento de cada tipo', () => {
    const h = hitosDeIncidente(incidente(), [llamada('l1', 23)], [evento('ASIGNADO', 26, 'u02'), evento('ASIGNADO', 25), evento('EN_RUTA', 27)]);
    expect(estados(h).slice(2, 5)).toEqual(['DESPACHADA:hecho', 'EN_RUTA:actual', 'EN_ESCENA:pendiente']);
    expect(h[2]?.recursoId).toBe('u01');
    expect(h[2]?.ms).toBe(Date.parse(T(25)));
    expect(h[3]?.recursoId).toBe('u01');
  });

  it('ignora llamadas y eventos de otros incidentes', () => {
    const h = hitosDeIncidente(incidente(), [llamada('l2', 20, 'otro')], [evento('ASIGNADO', 25, 'u01', 'otro')]);
    expect(h.map((x) => x.hito)).not.toContain('LLAMADA');
    expect(h.find((x) => x.hito === 'DESPACHADA')?.estado).toBe('pendiente');
  });

  it('contenido sin despacho: los hitos intermedios quedan omitidos y la hora sale de la bitácora', () => {
    const h = hitosDeIncidente(incidente('Contenido', [{ timestamp: T(30), descripcion: 'Estado cambiado a Contenido' }]), [], []);
    expect(estados(h)).toEqual(['CREADO:hecho', 'DESPACHADA:omitido', 'EN_RUTA:omitido', 'EN_ESCENA:omitido', 'CONTENIDO:actual', 'RESUELTO:pendiente']);
    expect(h[4]?.ms).toBe(Date.parse(T(30)));
  });

  it('resuelto: no hay hito actual, todo lo que consta queda hecho', () => {
    const h = hitosDeIncidente(incidente('Resuelto'), [llamada('l1', 23)], [evento('ASIGNADO', 25), evento('EN_RUTA', 26), evento('EN_ESCENA', 29)]);
    expect(h.some((x) => x.estado === 'actual')).toBe(false);
    expect(h.find((x) => x.hito === 'RESUELTO')).toMatchObject({ estado: 'hecho', ms: null });
  });
});
