import { describe, expect, it } from 'vitest';
import type { ZonaPublica } from '@argos/shared';
import { CAPAS_MAPA, CAPAS_POR_DEFECTO, alternarCapa, zonasVisibles } from './capasMapa';

const zona = (id: string, tipo: ZonaPublica['tipo']): ZonaPublica => ({
  id,
  tipo,
  nombre: id,
  geometria: { type: 'Point', coordinates: [0, 0] },
  capacidad_actual: 0,
  capacidad_maxima: 0,
});
const zonas = [zona('r1', 'Refugio'), zona('b1', 'Bloqueo de Vía'), zona('r2', 'Refugio')];

describe('capas del mapa', () => {
  it('arrancan todas visibles', () => {
    expect(CAPAS_MAPA.every((c) => CAPAS_POR_DEFECTO[c])).toBe(true);
  });

  it('alternar una capa no toca las demás ni muta el original', () => {
    const apagada = alternarCapa(CAPAS_POR_DEFECTO, 'perimetros');
    expect(apagada).toEqual({ unidades: true, perimetros: false, refugios: true, bloqueos: true });
    expect(CAPAS_POR_DEFECTO.perimetros).toBe(true);
    expect(alternarCapa(apagada, 'perimetros')).toEqual(CAPAS_POR_DEFECTO);
  });
});

describe('zonasVisibles', () => {
  it('con ambas capas encendidas devuelve las zonas tal cual', () => {
    expect(zonasVisibles(zonas, CAPAS_POR_DEFECTO)).toBe(zonas);
  });

  it('apagar refugios deja solo los bloqueos, y al revés', () => {
    expect(zonasVisibles(zonas, { ...CAPAS_POR_DEFECTO, refugios: false }).map((z) => z.id)).toEqual(['b1']);
    expect(zonasVisibles(zonas, { ...CAPAS_POR_DEFECTO, bloqueos: false }).map((z) => z.id)).toEqual(['r1', 'r2']);
  });

  it('con ambas apagadas no queda nada', () => {
    expect(zonasVisibles(zonas, { ...CAPAS_POR_DEFECTO, refugios: false, bloqueos: false })).toEqual([]);
  });
});
