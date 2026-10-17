import { describe, expect, it } from 'vitest';
import { aEventoRecurso, aFilaLlamada, aLlamada } from './filas';

describe('aLlamada', () => {
  it('convierte lat/lng en ubicacion y las claves en camelCase', () => {
    expect(
      aLlamada({
        id: 'l1',
        canal: 'VHF',
        tipo: 'INCENDIO',
        prioridad: 'P2',
        lat: 1.2162,
        lng: -77.2798,
        narrativa: 'Humo',
        reportante: null,
        callback: '300',
        incidente_id: 'i1',
        estado_validacion: 'Confirmado',
        operador_id: 'op-1',
        creado_en: '2026-10-07T12:00:00Z',
        imagen_url: null,
      }),
    ).toEqual({
      id: 'l1',
      canal: 'VHF',
      tipo: 'INCENDIO',
      prioridad: 'P2',
      ubicacion: { lat: 1.2162, lng: -77.2798 },
      narrativa: 'Humo',
      reportante: null,
      callback: '300',
      incidenteId: 'i1',
      estadoValidacion: 'Confirmado',
      operadorId: 'op-1',
      creadoEn: '2026-10-07T12:00:00Z',
    });
  });

  it('tolera filas antiguas sin narrativa ni operador', () => {
    const l = aLlamada({ id: 'l2', canal: '123', tipo: 'INCENDIO', prioridad: 'P3', lat: '1.5', lng: '-77', estado_validacion: 'No confirmado' });
    expect(l.narrativa).toBe('');
    expect(l.operadorId).toBeNull();
    expect(l.incidenteId).toBeNull();
    expect(l.ubicacion).toEqual({ lat: 1.5, lng: -77 });
  });
});

describe('aFilaLlamada', () => {
  const nueva = {
    canal: '123',
    tipo: 'FUGA_GAS',
    prioridad: 'P1',
    ubicacion: { lat: 1.21, lng: -77.28 },
    narrativa: 'Olor a gas',
    reportante: 'Vecino',
    callback: null,
  } as const;

  it('sin incidente queda "No confirmado" y sin operador (lo fija auth.uid() en la base)', () => {
    const fila = aFilaLlamada(nueva);
    expect(fila).toMatchObject({ lat: 1.21, lng: -77.28, incidente_id: null, estado_validacion: 'No confirmado' });
    expect(fila).not.toHaveProperty('operador_id');
    expect(fila).not.toHaveProperty('ubicacion');
  });

  it('con incidente nace "Confirmado" y vinculada', () => {
    expect(aFilaLlamada(nueva, 'i9')).toMatchObject({ incidente_id: 'i9', estado_validacion: 'Confirmado' });
  });
});

describe('aEventoRecurso', () => {
  it('convierte la fila y acota valores desconocidos', () => {
    expect(
      aEventoRecurso({ id: 'e1', recurso_id: 'r1', incidente_id: null, desde: 'ASIGNADO', hacia: 'EN_RUTA', origen: 'IA', creado_en: '2026-10-07T12:00:00Z' }),
    ).toEqual({ id: 'e1', recursoId: 'r1', incidenteId: null, desde: 'ASIGNADO', hacia: 'EN_RUTA', origen: 'IA', creadoEn: '2026-10-07T12:00:00Z' });
    const raro = aEventoRecurso({ id: 'e2', recurso_id: 'r1', desde: 'x', hacia: 'y', origen: 'z' });
    expect(raro).toMatchObject({ desde: 'INOPERATIVO', hacia: 'INOPERATIVO', origen: 'SISTEMA' });
  });
});
