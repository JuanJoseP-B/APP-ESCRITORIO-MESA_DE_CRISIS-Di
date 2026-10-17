import { describe, expect, it } from 'vitest';
import type { Recurso } from '@argos/shared';
import { unidadesParaMapa } from './unidadesMapa';

const rec = (id: string, estado: Recurso['estado_actual'], extra: Partial<Recurso> = {}): Recurso => ({
  id,
  tipo: 'Ambulancia',
  estado_actual: estado,
  incidente_asignado_id: null,
  etiqueta: id.toUpperCase(),
  ...extra,
});

describe('unidadesParaMapa', () => {
  it('prefiere la posición dada, luego la ubicación y por último la base', () => {
    const recursos = [
      rec('a', 'EN_RUTA', { base: { lat: 1, lng: 1 }, ubicacion: { lat: 2, lng: 2 } }),
      rec('b', 'DISPONIBLE', { base: { lat: 3, lng: 3 }, ubicacion: { lat: 4, lng: 4 } }),
      rec('c', 'DISPONIBLE', { base: { lat: 5, lng: 5 } }),
    ];
    const unidades = unidadesParaMapa(recursos, new Map([['a', { lat: 9, lng: 9 }]]));
    expect(unidades.map((u) => u.posicion)).toEqual([
      { lat: 9, lng: 9 },
      { lat: 4, lng: 4 },
      { lat: 5, lng: 5 },
    ]);
  });

  it('omite las unidades sin posición conocida', () => {
    expect(unidadesParaMapa([rec('a', 'DISPONIBLE'), rec('b', 'DISPONIBLE', { ubicacion: null, base: null })])).toEqual([]);
  });

  it('atenúa solo las inoperativas y conserva el indicativo completo', () => {
    const base = { lat: 1, lng: 1 };
    const [a, b] = unidadesParaMapa([rec('m10', 'INOPERATIVO', { base }), rec('m11', 'EN_ESCENA', { base })]);
    expect([a?.atenuada, a?.indicativo]).toEqual([true, 'M10']);
    expect([b?.atenuada, b?.estado]).toEqual([false, 'EN_ESCENA']);
  });
});
