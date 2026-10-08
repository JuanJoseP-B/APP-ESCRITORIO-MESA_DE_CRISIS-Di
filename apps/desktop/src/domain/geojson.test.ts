import { describe, expect, it } from 'vitest';
import type { Incidente } from '@argos/shared';
import { COLOR_CRITICIDAD, colorearFeatures, incidentesAFeatureCollection } from './geojson';

const base: Incidente = {
  id: 'a',
  titulo: 'Incendio forestal',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'INCENDIO',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [-70.6, -33.4] },
  timeline: [],
};

describe('incidentesAFeatureCollection', () => {
  it('devuelve una colección vacía sin incidentes', () => {
    expect(incidentesAFeatureCollection([])).toEqual({ type: 'FeatureCollection', features: [] });
  });

  it('conserva la geometría Point y Polygon', () => {
    const poligono: Incidente = {
      ...base,
      id: 'b',
      geometria: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [1, 0],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    };
    const { features } = incidentesAFeatureCollection([base, poligono]);
    expect(features.map((f) => f.geometry.type)).toEqual(['Point', 'Polygon']);
  });

  it('asigna el color según la criticidad', () => {
    const { features } = incidentesAFeatureCollection([
      base,
      { ...base, id: 'm', nivel_criticidad: 'Medio' },
      { ...base, id: 'l', nivel_criticidad: 'Bajo' },
    ]);
    expect(features.map((f) => f.properties.color)).toEqual([
      COLOR_CRITICIDAD.Crítico,
      COLOR_CRITICIDAD.Medio,
      COLOR_CRITICIDAD.Bajo,
    ]);
  });

  it('colorearFeatures sustituye el token por el valor del tema sin mutar el original', () => {
    const original = incidentesAFeatureCollection([base]);
    const pintada = colorearFeatures(original, (token) => `valor(${token})`);
    expect(pintada.features[0]?.properties.color).toBe('valor(status-critical)');
    expect(original.features[0]?.properties.color).toBe('status-critical');
  });

  it('los colores del dominio son tokens, no hex', () => {
    expect(Object.values(COLOR_CRITICIDAD).every((t) => !t.startsWith('#'))).toBe(true);
  });
});
