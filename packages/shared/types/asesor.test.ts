import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  CONFIANZAS_ASESOR,
  ERRORES_ASESOR,
  type MotorAsesor,
  type RadiosPerimetro,
  type RecomendacionAsesor,
  type ResultadoAsesor,
  type SnapshotAsesor,
} from './index';

describe('contratos del asesor de despacho', () => {
  it('fijan los niveles de confianza y los códigos de error', () => {
    expect(CONFIANZAS_ASESOR).toEqual(['ALTA', 'MEDIA', 'BAJA']);
    expect(ERRORES_ASESOR).toContain('SIN_RECOMENDACION');
    expect(ERRORES_ASESOR).toContain('RESPUESTA_INVALIDA');
  });

  it('el perímetro sugerido usa los radios del dominio, sin un tipo paralelo', () => {
    expectTypeOf<RecomendacionAsesor['perimetroSugerido']>().toEqualTypeOf<RadiosPerimetro>();
    expectTypeOf<SnapshotAsesor['incidente']['perimetroActual']>().toEqualTypeOf<RadiosPerimetro | null>();
  });

  it('el snapshot no tiene campos del reportante', () => {
    expectTypeOf<SnapshotAsesor['incidente']>().not.toHaveProperty('reportante');
    expectTypeOf<SnapshotAsesor['incidente']>().not.toHaveProperty('callback');
  });

  it('un motor recibe el snapshot y devuelve un resultado asíncrono', () => {
    expectTypeOf<MotorAsesor['recomendar']>().toEqualTypeOf<(snapshot: SnapshotAsesor) => Promise<ResultadoAsesor>>();
  });
});
