import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ETIQUETAS_TIPO_EMERGENCIA,
  TIPOS_EMERGENCIA,
  TIPOS_REPORTE,
  esTipoEmergencia,
  etiquetaTipoEmergencia,
  type Reporte,
  type TipoEmergencia,
} from './index';

describe('tipos de emergencia', () => {
  it('exporta el catálogo completo', () => {
    expect(TIPOS_EMERGENCIA).toEqual([
      'INCENDIO',
      'CRECIENTE_SUBITA',
      'DESLIZAMIENTO',
      'VIA_BLOQUEADA',
      'FUGA_GAS',
      'INUNDACION',
    ]);
  });

  it('los reportes usan ese mismo catálogo', () => {
    expect(TIPOS_REPORTE).toBe(TIPOS_EMERGENCIA);
    expectTypeOf<Reporte['tipo']>().toEqualTypeOf<TipoEmergencia>();
  });

  it('cada tipo tiene etiqueta legible', () => {
    for (const t of TIPOS_EMERGENCIA) expect(ETIQUETAS_TIPO_EMERGENCIA[t]).toMatch(/^[A-ZÁÉÍÓÚ][a-záéíóúñ ]+$/);
    expect(etiquetaTipoEmergencia('CRECIENTE_SUBITA')).toBe('Creciente súbita');
  });

  it('un valor fuera del catálogo no es válido y se muestra tal cual', () => {
    expect(esTipoEmergencia('Otro')).toBe(false);
    expect(esTipoEmergencia('FUGA_GAS')).toBe(true);
    expect(etiquetaTipoEmergencia('Otro')).toBe('Otro');
  });
});
