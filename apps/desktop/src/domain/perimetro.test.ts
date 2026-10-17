import { describe, expect, it } from 'vitest';
import { PROTOCOLOS_PERIMETRO, RADIOS_POR_DEFECTO, type Incidente } from '@argos/shared';
import { distanciaM } from './geo';
import {
  COLOR_ANILLO,
  anillosAFeatureCollection,
  etiquetaRadio,
  generarAnillos,
  perimetroDeIncidente,
} from './perimetro';

const centro = { lat: 1.2136, lng: -77.2811 };

const incidente = (extra: Partial<Incidente> = {}): Incidente => ({
  id: 'i1',
  titulo: 'Incidente',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: null,
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [centro.lng, centro.lat] },
  timeline: [],
  ...extra,
});

describe('generarAnillos', () => {
  it('genera tres anillos concéntricos de CALIENTE a EVACUACION con el radio pedido', () => {
    const anillos = generarAnillos(centro, RADIOS_POR_DEFECTO);
    expect(anillos.map((a) => [a.anillo, a.radioM])).toEqual([
      ['CALIENTE', 100],
      ['TIBIA', 300],
      ['EVACUACION', 500],
    ]);
    for (const a of anillos) {
      const vertices = a.poligono.coordinates[0] ?? [];
      expect(vertices.length).toBeGreaterThan(32);
      for (const [lng, lat] of vertices) {
        expect(distanciaM(centro, { lat, lng })).toBeCloseTo(a.radioM, -1);
      }
      expect(vertices[0]).toEqual(vertices.at(-1));
    }
  });

  it('cada anillo contiene al anterior y su punto norte queda sobre el centro a esa distancia', () => {
    const [a, b] = generarAnillos(centro, RADIOS_POR_DEFECTO);
    if (!a || !b) throw new Error('faltan anillos');
    expect(distanciaM(centro, b.norte)).toBeGreaterThan(distanciaM(centro, a.norte));
    expect(a.norte.lng).toBeCloseTo(centro.lng, 6);
    expect(a.norte.lat).toBeGreaterThan(centro.lat);
    expect(distanciaM(centro, a.norte)).toBeCloseTo(100, -1);
  });
});

describe('perimetroDeIncidente', () => {
  it('sin tipo usa 100/300/500 m', () => {
    expect(perimetroDeIncidente(incidente()).radios).toEqual(RADIOS_POR_DEFECTO);
  });

  it('con tipo usa PROTOCOLOS_PERIMETRO', () => {
    const p = perimetroDeIncidente(incidente({ tipo: 'FUGA_GAS' }));
    expect(p.radios).toEqual(PROTOCOLOS_PERIMETRO.FUGA_GAS);
    expect(p.anillos.at(-1)?.radioM).toBe(800);
  });

  it('un perímetro ya guardado manda sobre el protocolo y fija el centro', () => {
    const guardado = { centro: { lat: 1.3, lng: -77.3 }, radios: { CALIENTE: 20, TIBIA: 40, EVACUACION: 60 }, origen: 'AUTO', poligonoManual: null } as const;
    const p = perimetroDeIncidente(incidente({ tipo: 'FUGA_GAS', perimetro: guardado }));
    expect(p.centro).toEqual(guardado.centro);
    expect(p.radios).toEqual(guardado.radios);
  });

  it('el centro de un incidente con polígono es el centroide de sus vértices', () => {
    const geometria = { type: 'Polygon', coordinates: [[[0, 0], [2, 0], [2, 2], [0, 2], [0, 0]]] } as const;
    expect(perimetroDeIncidente(incidente({ geometria })).centro).toEqual({ lng: 1, lat: 1 });
  });
});

describe('anillosAFeatureCollection', () => {
  it('pinta los tres con el token crítico y opacidades que decrecen hacia fuera', () => {
    const { features } = anillosAFeatureCollection(generarAnillos(centro, RADIOS_POR_DEFECTO), 0.2);
    expect(features.map((f) => f.properties.color)).toEqual([COLOR_ANILLO, COLOR_ANILLO, COLOR_ANILLO]);
    const [c, t, e] = features.map((f) => f.properties.opacidad);
    expect(c).toBeGreaterThan(t ?? 1);
    expect(t).toBeGreaterThan(e ?? 1);
    expect(e).toBeGreaterThan(0);
  });

  it('la opacidad nunca pasa de 1, aunque la base del tema sea alta', () => {
    const { features } = anillosAFeatureCollection(generarAnillos(centro, RADIOS_POR_DEFECTO), 0.9);
    expect(Math.max(...features.map((f) => f.properties.opacidad))).toBe(1);
  });
});

describe('etiquetaRadio', () => {
  it('rotula en metros por debajo de 1 km y en kilómetros por encima', () => {
    expect(etiquetaRadio(100)).toBe('100 m');
    expect(etiquetaRadio(800)).toBe('800 m');
    expect(etiquetaRadio(1500, 'es')).toBe('1,5 km');
    expect(etiquetaRadio(1500, 'en')).toBe('1.5 km');
  });
});
