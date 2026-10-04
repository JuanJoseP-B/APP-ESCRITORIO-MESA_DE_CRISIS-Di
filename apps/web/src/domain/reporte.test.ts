import { describe, expect, it } from 'vitest';
import { TAMANO_MAX_FOTO, validarReporte } from './reporte';

const ok = { tipo: 'Incendio', lat: -33.4, lng: -70.6 };

describe('validarReporte', () => {
  it('acepta un reporte válido sin foto', () => {
    expect(validarReporte(ok)).toEqual([]);
  });

  it('exige ubicación', () => {
    expect(validarReporte({ ...ok, lat: null, lng: null })).toHaveLength(1);
  });

  it('rechaza coordenadas fuera de rango o no finitas', () => {
    expect(validarReporte({ ...ok, lat: 91 })).toHaveLength(1);
    expect(validarReporte({ ...ok, lng: -181 })).toHaveLength(1);
    expect(validarReporte({ ...ok, lat: Number.NaN })).toHaveLength(1);
  });

  it('rechaza tipos desconocidos', () => {
    expect(validarReporte({ ...ok, tipo: 'Otra cosa' })).toHaveLength(1);
  });

  it('valida la foto: debe ser imagen y ≤ 5 MB', () => {
    expect(validarReporte(ok, { type: 'image/jpeg', size: 1000 })).toEqual([]);
    expect(validarReporte(ok, { type: 'application/pdf', size: 1000 })).toHaveLength(1);
    expect(validarReporte(ok, { type: 'image/png', size: TAMANO_MAX_FOTO + 1 })).toHaveLength(1);
  });
});
