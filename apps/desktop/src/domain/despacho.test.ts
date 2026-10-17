import { describe, expect, it } from 'vitest';
import type { EstadoRecurso, Incidente, Recurso } from '@argos/shared';
import { candidatasDeDespacho, formatearDistancia } from './despacho';

const incidente: Pick<Incidente, 'geometria' | 'perimetro'> = { geometria: { type: 'Point', coordinates: [-77.2811, 1.2136] }, perimetro: undefined };

const unidad = (id: string, estado: EstadoRecurso, extra: Partial<Recurso> = {}): Recurso => ({
  id,
  etiqueta: id,
  tipo: 'Ambulancia',
  estado_actual: estado,
  incidente_asignado_id: null,
  ...extra,
});

describe('candidatasDeDespacho', () => {
  it('solo ofrece unidades DISPONIBLES, de la más cercana a la más lejana', () => {
    const recursos = [
      unidad('lejos', 'DISPONIBLE', { base: { lat: 1.2262, lng: -77.2811 } }),
      unidad('cerca', 'DISPONIBLE', { base: { lat: 1.2141, lng: -77.2811 } }),
      unidad('ocupada', 'ASIGNADO', { base: { lat: 1.2136, lng: -77.2811 } }),
      unidad('rota', 'INOPERATIVO', { base: { lat: 1.2136, lng: -77.2811 } }),
      unidad('media', 'DISPONIBLE', { base: { lat: 1.2186, lng: -77.2811 } }),
    ];
    const r = candidatasDeDespacho(recursos, incidente);
    expect(r.map((c) => c.indicativo)).toEqual(['cerca', 'media', 'lejos']);
    expect(r[0]?.distanciaM).toBeGreaterThan(50);
    expect(r[0]?.distanciaM).toBeLessThan(60);
  });

  it('usa la ubicación actual por encima de la base', () => {
    const r = candidatasDeDespacho(
      [unidad('a', 'DISPONIBLE', { base: { lat: 1.3, lng: -77.2811 }, ubicacion: { lat: 1.2137, lng: -77.2811 } })],
      incidente,
    );
    expect(r[0]?.distanciaM).toBeLessThan(20);
  });

  it('las unidades sin posición conocida van al final, por indicativo, con distancia null', () => {
    const recursos = [
      unidad('M-2', 'DISPONIBLE'),
      unidad('M-10', 'DISPONIBLE'),
      unidad('con', 'DISPONIBLE', { base: { lat: 1.4, lng: -77.2811 } }),
    ];
    const r = candidatasDeDespacho(recursos, incidente);
    expect(r.map((c) => c.indicativo)).toEqual(['con', 'M-2', 'M-10']);
    expect(r.map((c) => c.distanciaM === null)).toEqual([false, true, true]);
  });

  it('a igual distancia desempata por indicativo y sin unidades libres devuelve una lista vacía', () => {
    const base = { lat: 1.2146, lng: -77.2811 };
    const r = candidatasDeDespacho([unidad('B', 'DISPONIBLE', { base }), unidad('A', 'DISPONIBLE', { base })], incidente);
    expect(r.map((c) => c.indicativo)).toEqual(['A', 'B']);
    expect(candidatasDeDespacho([unidad('x', 'EN_RUTA')], incidente)).toEqual([]);
  });

  it('mide hasta el centro del perímetro cuando el incidente lo tiene', () => {
    const conPerimetro = {
      ...incidente,
      perimetro: { centro: { lat: 1.3, lng: -77.2811 }, radios: { caliente: 100, tibia: 300, evacuacion: 500 }, origen: 'AUTO', poligonoManual: null },
    } as unknown as Pick<Incidente, 'geometria' | 'perimetro'>;
    const r = candidatasDeDespacho([unidad('a', 'DISPONIBLE', { base: { lat: 1.3, lng: -77.2811 } })], conPerimetro);
    expect(r[0]?.distanciaM).toBeLessThan(1);
  });
});

describe('formatearDistancia', () => {
  it('usa metros por debajo de 1 km y kilómetros con un decimal por encima', () => {
    expect(formatearDistancia(648.4, 'es')).toBe('648 m');
    expect(formatearDistancia(1250, 'es')).toBe('1,3 km');
    expect(formatearDistancia(1250, 'en')).toBe('1.3 km');
  });

  it('muestra una raya si no se conoce', () => {
    expect(formatearDistancia(null, 'es')).toBe('—');
  });
});
