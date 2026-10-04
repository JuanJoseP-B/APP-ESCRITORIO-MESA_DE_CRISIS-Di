import { describe, expect, it } from 'vitest';
import type { ZonaPublica, ZonaRiesgo } from '@argos/shared';
import { COLOR_BLOQUEO, COLOR_CRITICIDAD, COLOR_REFUGIO, zonasAFeatureCollection } from './geojson';

const punto = { type: 'Point', coordinates: [-70.6, -33.4] } as const;

const riesgo = (id: string, estado: ZonaRiesgo['estado']): ZonaRiesgo => ({
  id,
  titulo: `Zona ${id}`,
  nivel_criticidad: 'Crítico',
  estado,
  geometria: punto,
});

const publica = (id: string, tipo: ZonaPublica['tipo']): ZonaPublica => ({
  id,
  tipo,
  nombre: `Sitio ${id}`,
  geometria: punto,
  capacidad_actual: 30,
  capacidad_maxima: 120,
});

describe('zonasAFeatureCollection', () => {
  it('excluye incidentes resueltos', () => {
    const fc = zonasAFeatureCollection([riesgo('a', 'Abierto'), riesgo('b', 'Resuelto')], []);
    expect(fc.features.map((f) => f.id)).toEqual(['a']);
  });

  it('colorea riesgo por criticidad, refugios en verde y bloqueos en ámbar', () => {
    const fc = zonasAFeatureCollection([riesgo('a', 'Abierto')], [publica('r', 'Refugio'), publica('b', 'Bloqueo de Vía')]);
    const colores = Object.fromEntries(fc.features.map((f) => [f.id, f.properties.color]));
    expect(colores).toEqual({ a: COLOR_CRITICIDAD['Crítico'], r: COLOR_REFUGIO, b: COLOR_BLOQUEO });
  });

  it('informa la ocupación solo en refugios', () => {
    const fc = zonasAFeatureCollection([], [publica('r', 'Refugio'), publica('b', 'Bloqueo de Vía')]);
    expect(fc.features.map((f) => f.properties.ocupacion)).toEqual(['30/120', '']);
  });

  it('no filtra datos tácticos a las propiedades', () => {
    const fc = zonasAFeatureCollection([riesgo('a', 'Abierto')], []);
    expect(Object.keys(fc.features[0]?.properties ?? {}).sort()).toEqual(
      ['categoria', 'color', 'id', 'nombre', 'ocupacion'],
    );
  });
});
