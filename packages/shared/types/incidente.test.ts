import { describe, expect, expectTypeOf, it } from 'vitest';
import { ESTADOS_INCIDENTE, NIVELES_CRITICIDAD } from './incidente';
import type { Incidente, Recurso } from './index';

function describirGeometria(incidente: Incidente): string {
  const { geometria } = incidente;
  switch (geometria.type) {
    case 'Point':
      return `punto:${geometria.coordinates.join(',')}`;
    case 'Polygon':
      return `poligono:${geometria.coordinates[0]?.length ?? 0}`;
  }
}

describe('Incidente', () => {
  it('expone los niveles de criticidad definidos en SPEC §4', () => {
    expect(NIVELES_CRITICIDAD).toEqual(['Bajo', 'Medio', 'Crítico']);
  });

  it('expone los estados definidos en SPEC §4', () => {
    expect(ESTADOS_INCIDENTE).toEqual(['Abierto', 'Contenido', 'Resuelto']);
  });

  it('discrimina la geometría por su tipo (Point / Polygon)', () => {
    const base = {
      id: 'inc-1',
      titulo: 'Incendio forestal',
      nivel_criticidad: 'Crítico',
      estado: 'Abierto',
      timeline: [{ timestamp: '2026-10-01T12:00:00Z', descripcion: 'Reporte recibido' }],
    } as const;

    const punto: Incidente = { ...base, geometria: { type: 'Point', coordinates: [-70.65, -33.45] } };
    const poligono: Incidente = {
      ...base,
      geometria: {
        type: 'Polygon',
        coordinates: [
          [
            [0, 0],
            [0, 1],
            [1, 1],
            [0, 0],
          ],
        ],
      },
    };

    expect(describirGeometria(punto)).toBe('punto:-70.65,-33.45');
    expect(describirGeometria(poligono)).toBe('poligono:4');
  });
});

describe('Recurso', () => {
  it('no expone coordenadas GPS (seguridad operativa)', () => {
    expectTypeOf<Recurso>().not.toHaveProperty('lat');
    expectTypeOf<Recurso>().not.toHaveProperty('lng');
  });
});
