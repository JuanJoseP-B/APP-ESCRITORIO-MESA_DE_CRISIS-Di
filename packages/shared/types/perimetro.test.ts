import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ANILLOS,
  PROTOCOLOS_PERIMETRO,
  RADIOS_POR_DEFECTO,
  TIPOS_EMERGENCIA,
  radiosParaTipo,
  radiosValidos,
  type PerimetroRiesgo,
} from './index';

describe('radios de perímetro', () => {
  it('los radios por defecto son 100 / 300 / 500 m', () => {
    expect(ANILLOS).toEqual(['CALIENTE', 'TIBIA', 'EVACUACION']);
    expect(RADIOS_POR_DEFECTO).toEqual({ CALIENTE: 100, TIBIA: 300, EVACUACION: 500 });
  });

  it('hay protocolo para cada tipo de emergencia y sus radios son válidos', () => {
    for (const tipo of TIPOS_EMERGENCIA) expect(radiosValidos(PROTOCOLOS_PERIMETRO[tipo])).toBe(true);
  });

  it('un incidente sin tipo usa los radios por defecto', () => {
    expect(radiosParaTipo(null)).toBe(RADIOS_POR_DEFECTO);
    expect(radiosParaTipo('DESLIZAMIENTO')).toBe(PROTOCOLOS_PERIMETRO.DESLIZAMIENTO);
  });

  it('rechaza radios no positivos, iguales o decrecientes', () => {
    expect(radiosValidos({ CALIENTE: 0, TIBIA: 300, EVACUACION: 500 })).toBe(false);
    expect(radiosValidos({ CALIENTE: 100, TIBIA: 100, EVACUACION: 500 })).toBe(false);
    expect(radiosValidos({ CALIENTE: 100, TIBIA: 300, EVACUACION: 250 })).toBe(false);
    expect(radiosValidos({ CALIENTE: 100, TIBIA: 300, EVACUACION: Number.NaN })).toBe(false);
  });

  it('el perímetro guarda el origen y el polígono manual opcional', () => {
    expectTypeOf<PerimetroRiesgo['origen']>().toEqualTypeOf<'AUTO' | 'MANUAL' | 'IA'>();
    const p: PerimetroRiesgo = { centro: { lat: 1.2, lng: -77.3 }, radios: RADIOS_POR_DEFECTO, origen: 'AUTO', poligonoManual: null };
    expect(p.poligonoManual).toBeNull();
  });
});
