import { describe, expect, it } from 'vitest';
import { agregarEvento } from './incidente';
import { incidenteDesdeReporte, puedeValidarReporte, type Reporte } from './reporte';
import { ajustarOcupacion, zonaDesdeTrazado } from './zona-publica';

const ahora = new Date('2026-10-04T10:00:00Z');
const reporte: Reporte = {
  id: 'r1', tipo: 'INCENDIO', lat: 1.2, lng: -77.3, imagen_url: null, estado_validacion: 'No confirmado',
};

describe('agregarEvento', () => {
  it('añade al final sin mutar y omite autor si no se indica', () => {
    const base = agregarEvento([], 'a', ahora);
    const nuevo = agregarEvento(base, 'b', ahora, 'op');
    expect(base).toHaveLength(1);
    expect(nuevo.map((e) => e.descripcion)).toEqual(['a', 'b']);
    expect('autor' in nuevo[0]!).toBe(false);
    expect(nuevo[1]?.autor).toBe('op');
    expect(nuevo[0]?.timestamp).toBe('2026-10-04T10:00:00.000Z');
  });
});

describe('reportes', () => {
  it('solo los "No confirmado" se pueden validar', () => {
    expect(puedeValidarReporte(reporte)).toBe(true);
    expect(puedeValidarReporte({ estado_validacion: 'Confirmado' })).toBe(false);
    expect(puedeValidarReporte({ estado_validacion: 'Descartado' })).toBe(false);
  });

  it('crea un incidente punto [lng, lat] con evento inicial', () => {
    const i = incidenteDesdeReporte(reporte, ahora);
    expect(i.geometria).toEqual({ type: 'Point', coordinates: [-77.3, 1.2] });
    expect(i).toMatchObject({ estado: 'Abierto', nivel_criticidad: 'Medio', prioridad: 'P2', tipo: 'INCENDIO' });
    expect(i.titulo).toContain('Incendio');
    expect(i.timeline).toHaveLength(1);
  });
});

describe('ajustarOcupacion', () => {
  it('acota entre 0 y la capacidad máxima', () => {
    const z = { capacidad_actual: 8, capacidad_maxima: 10 };
    expect(ajustarOcupacion(z, 5)).toBe(10);
    expect(ajustarOcupacion(z, -20)).toBe(0);
    expect(ajustarOcupacion(z, -3)).toBe(5);
  });
});

describe('zonaDesdeTrazado', () => {
  it('crea un Bloqueo de Vía sin aforo con la geometría trazada y un nombre fechado', () => {
    const linea = { type: 'LineString', coordinates: [[0, 0], [1, 1]] } as const;
    expect(zonaDesdeTrazado(linea, ahora)).toEqual({
      tipo: 'Bloqueo de Vía',
      nombre: 'Tramo trazado 2026-10-04 10:00 UTC',
      geometria: linea,
      capacidad_actual: 0,
      capacidad_maxima: 0,
    });
    const poligono = { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] } as const;
    expect(zonaDesdeTrazado(poligono, ahora).nombre).toBe('Zona trazada 2026-10-04 10:00 UTC');
  });
});
