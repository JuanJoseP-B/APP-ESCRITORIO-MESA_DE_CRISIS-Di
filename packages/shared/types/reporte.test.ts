import { describe, expect, it } from 'vitest';
import { codigoReporte } from './reporte';

describe('codigoReporte', () => {
  it('devuelve los primeros 8 caracteres en mayúsculas', () => {
    expect(codigoReporte('0b9f2c1e-1111-4222-8333-444455556666')).toBe('0B9F2C1E');
  });
});
