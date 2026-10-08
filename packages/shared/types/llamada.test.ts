import { describe, expect, it } from 'vitest';
import {
  CANALES_LLAMADA,
  ETIQUETAS_CANAL_LLAMADA,
  NIVELES_CRITICIDAD,
  PRIORIDADES,
  PRIORIDAD_POR_CRITICIDAD,
  esPrioridad,
  rangoPrioridad,
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
