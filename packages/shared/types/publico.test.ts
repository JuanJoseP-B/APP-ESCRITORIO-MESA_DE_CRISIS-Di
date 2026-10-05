import { describe, expectTypeOf, it } from 'vitest';
import type { NuevoReporte, Reporte, ZonaPublica, ZonaRiesgo } from './index';

describe('tipos públicos', () => {
  it('ZonaRiesgo no expone el timeline del incidente', () => {
    expectTypeOf<ZonaRiesgo>().not.toHaveProperty('timeline');
  });

  it('NuevoReporte no permite fijar el estado de validación ni el id', () => {
    expectTypeOf<NuevoReporte>().not.toHaveProperty('estado_validacion');
    expectTypeOf<NuevoReporte>().not.toHaveProperty('id');
    expectTypeOf<NuevoReporte['tipo']>().toEqualTypeOf<Reporte['tipo']>();
  });

  it('ZonaPublica incluye nombre y geometría', () => {
    expectTypeOf<ZonaPublica>().toHaveProperty('nombre');
    expectTypeOf<ZonaPublica>().toHaveProperty('geometria');
  });
});
