import { describe, expect, it } from 'vitest';
import { figuraDesdeDibujo } from './trazado';

describe('figuraDesdeDibujo', () => {
  it('normaliza un polígono cerrando el anillo', () => {
    const r = figuraDesdeDibujo({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1]]] });
    expect(r).toEqual({
      valido: true,
      figura: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
    });
  });

  it('rechaza polígonos degenerados', () => {
    const r = figuraDesdeDibujo({ type: 'Polygon', coordinates: [[[0, 0], [1, 0], [0, 0]]] });
    expect(r).toEqual({ valido: false, error: 'Se requieren al menos 3 vértices distintos' });
  });

  it('acepta líneas de 2 o más puntos y descarta coordenadas no numéricas', () => {
    const r = figuraDesdeDibujo({ type: 'LineString', coordinates: [[0, 0], ['x', 1], [2, 3, 99]] });
    expect(r).toEqual({ valido: true, figura: { type: 'LineString', coordinates: [[0, 0], [2, 3]] } });
  });

  it('rechaza líneas de un solo punto y figuras no admitidas', () => {
    expect(figuraDesdeDibujo({ type: 'LineString', coordinates: [[0, 0], [0, 0]] }).valido).toBe(false);
    expect(figuraDesdeDibujo({ type: 'Point', coordinates: [0, 0] })).toEqual({
      valido: false,
      error: 'Figura no admitida: Point',
    });
    expect(figuraDesdeDibujo({ type: 'Polygon', coordinates: null }).valido).toBe(false);
  });
});
