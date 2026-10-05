import { describe, expect, it } from 'vitest';
import type { Posicion } from '@argos/shared';
import { construirPoligono } from './poligono';

const A: Posicion = [0, 0];
const B: Posicion = [1, 0];
const C: Posicion = [1, 1];

describe('construirPoligono', () => {
  it('rechaza una lista vacía', () => {
    expect(construirPoligono([])).toEqual({ valido: false, error: 'Faltan vértices' });
  });

  it('rechaza menos de 3 vértices distintos', () => {
    expect(construirPoligono([A, B, A]).valido).toBe(false);
    expect(construirPoligono([A, B]).valido).toBe(false);
  });

  it('cierra el anillo abierto', () => {
    const r = construirPoligono([A, B, C]);
    expect(r.valido && r.poligono.coordinates[0]).toEqual([A, B, C, A]);
  });

  it('no duplica el cierre si el anillo ya está cerrado', () => {
    const r = construirPoligono([A, B, C, A]);
    expect(r.valido && r.poligono.coordinates[0]).toEqual([A, B, C, A]);
  });
});
