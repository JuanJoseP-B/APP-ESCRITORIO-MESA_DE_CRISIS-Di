import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CANALES_LLAMADA,
  ETIQUETAS_CANAL_LLAMADA,
  NIVELES_CRITICIDAD,
  PARAMETROS_DUPLICADOS,
  PRIORIDADES,
  PRIORIDAD_POR_CRITICIDAD,
  esPrioridad,
  rangoPrioridad,
  type Llamada,
  type NuevaLlamada,
  type ParametrosDuplicados,
} from './index';

describe('canales y prioridades de llamada', () => {
  it('exporta los cuatro canales con etiqueta', () => {
    expect(CANALES_LLAMADA).toEqual(['123', 'VHF', 'SENSOR', 'PRESENCIAL']);
    for (const canal of CANALES_LLAMADA) expect(ETIQUETAS_CANAL_LLAMADA[canal]).toBeTruthy();
  });

  it('las prioridades van de P1 (más urgente) a P4', () => {
    expect(PRIORIDADES).toEqual(['P1', 'P2', 'P3', 'P4']);
    expect(rangoPrioridad('P1')).toBeLessThan(rangoPrioridad('P4'));
    expect(esPrioridad('P2')).toBe(true);
    expect(esPrioridad('P5')).toBe(false);
  });

  it('cada nivel de criticidad tiene una prioridad equivalente', () => {
    for (const nivel of NIVELES_CRITICIDAD) expect(PRIORIDADES).toContain(PRIORIDAD_POR_CRITICIDAD[nivel]);
    expect(PRIORIDAD_POR_CRITICIDAD).toEqual({ Crítico: 'P1', Medio: 'P2', Bajo: 'P3' });
  });
});

describe('contratos de llamada y duplicados', () => {
  it('NuevaLlamada solo pide lo que captura el formulario', () => {
    const nueva: NuevaLlamada = {
      canal: '123',
      tipo: 'INCENDIO',
      prioridad: 'P2',
      ubicacion: { lat: 1.2136, lng: -77.2811 },
      narrativa: 'Humo visible en una bodega',
      reportante: null,
      callback: null,
    };
    expect(nueva.canal).toBe('123');
    expectTypeOf<NuevaLlamada>().not.toHaveProperty('id');
    expectTypeOf<NuevaLlamada>().not.toHaveProperty('incidenteId');
    expectTypeOf<Llamada['incidenteId']>().toEqualTypeOf<string | null>();
  });

  it('los parámetros por defecto son los del roadmap', () => {
    expect(PARAMETROS_DUPLICADOS).toEqual({ radioMaxM: 500, ventanaMin: 30, umbral: 0.6, maxCandidatos: 3 });
    expectTypeOf(PARAMETROS_DUPLICADOS).toEqualTypeOf<ParametrosDuplicados>();
  });
});
