import { describe, expect, it } from 'vitest';
import type { Reporte, ZonaPublica } from '@argos/shared';
import {
  COLOR_BLOQUEO,
  COLOR_REFUGIO,
  reportesAFeatureCollection,
  zonasAFeatureCollection,
} from './geojson';

describe('zonasAFeatureCollection', () => {
  it('conserva la geometría (punto, polígono o línea) y colorea por tipo', () => {
    const base = { nombre: 'x', capacidad_actual: 0, capacidad_maxima: 0 };
    const zonas: ZonaPublica[] = [
      { ...base, id: 'a', tipo: 'Refugio', geometria: { type: 'Point', coordinates: [0, 0] } },
      { ...base, id: 'b', tipo: 'Bloqueo de Vía', geometria: { type: 'LineString', coordinates: [[0, 0], [1, 1]] } },
    ];
    const { features } = zonasAFeatureCollection(zonas);
    expect(features.map((f) => [f.geometry.type, f.properties.color])).toEqual([
      ['Point', COLOR_REFUGIO],
      ['LineString', COLOR_BLOQUEO],
    ]);
  });
});

describe('reportesAFeatureCollection', () => {
  const reporte = (id: string, estado: Reporte['estado_validacion']): Reporte => ({
    id,
    tipo: 'FUGA_GAS',
    lat: 1.2,
    lng: -77.3,
    imagen_url: null,
    estado_validacion: estado,
  });

  it('solo incluye reportes sin validar, como puntos [lng, lat], y marca el seleccionado', () => {
    const { features } = reportesAFeatureCollection(
      [reporte('r1', 'No confirmado'), reporte('r2', 'Confirmado'), reporte('r3', 'No confirmado')],
      'r3',
    );
    expect(features.map((f) => [f.id, f.properties.seleccionado])).toEqual([
      ['r1', false],
      ['r3', true],
    ]);
    expect(features[0]?.geometry).toEqual({ type: 'Point', coordinates: [-77.3, 1.2] });
    expect(features[0]?.properties.nombre).toBe('Fuga de gas');
  });
});
