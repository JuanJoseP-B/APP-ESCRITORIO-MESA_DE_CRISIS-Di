import { describe, expect, it } from 'vitest';
import { RADIOS_POR_DEFECTO, type ZonaPublica } from '@argos/shared';
import { analizarPerimetro } from './analisisEspacial';
import { generarAnillos } from './perimetro';
import type { UnidadMapa } from './unidadesMapa';

const centro = { lat: 1.2136, lng: -77.2811 };
const anillos = generarAnillos(centro, RADIOS_POR_DEFECTO);
/** 1° de latitud ≈ 111 195 m: desplaza `m` metros al norte del centro. */
const alNorte = (m: number): [number, number] => [centro.lng, centro.lat + m / 111_195];

const refugio = (id: string, metros: number): ZonaPublica => ({
  id,
  tipo: 'Refugio',
  nombre: `Refugio ${id}`,
  geometria: { type: 'Point', coordinates: alNorte(metros) },
  capacidad_actual: 0,
  capacidad_maxima: 100,
});

const bloqueo = (id: string, geometria: ZonaPublica['geometria']): ZonaPublica => ({
  id,
  tipo: 'Bloqueo de Vía',
  nombre: id,
  geometria,
  capacidad_actual: 0,
  capacidad_maxima: 0,
});

const unidad = (id: string, metros: number, estado: UnidadMapa['estado'] = 'EN_ESCENA'): UnidadMapa => {
  const [lng, lat] = alNorte(metros);
  return { id, indicativo: id, tipo: 'Bomberos', estado, posicion: { lat, lng }, atenuada: false };
};

describe('analizarPerimetro · refugios', () => {
  const cuatro = [refugio('a', 50), refugio('b', 200), refugio('c', 400), refugio('d', 900)];

  it('los clasifica por el anillo más interno que los contiene', () => {
    const { refugios } = analizarPerimetro(anillos, cuatro, []);
    expect(refugios.map((r) => [r.id, r.anillo])).toEqual([
      ['a', 'CALIENTE'],
      ['b', 'TIBIA'],
      ['c', 'EVACUACION'],
      ['d', 'FUERA'],
    ]);
  });

  it('solo es apto el refugio que queda fuera de CALIENTE y TIBIA', () => {
    const { refugios } = analizarPerimetro(anillos, cuatro, []);
    expect(refugios.map((r) => r.apto)).toEqual([false, false, true, true]);
  });

  it('un refugio con área que solapa la zona caliente cuenta como caliente', () => {
    const [lng0, lat0] = alNorte(80);
    const [lng1, lat1] = alNorte(600);
    const area: ZonaPublica = {
      ...refugio('p', 0),
      geometria: { type: 'Polygon', coordinates: [[[lng0 - 0.0005, lat0], [lng0 + 0.0005, lat0], [lng1, lat1], [lng0 - 0.0005, lat0]]] },
    };
    expect(analizarPerimetro(anillos, [area], []).refugios[0]).toMatchObject({ anillo: 'CALIENTE', apto: false });
  });

  it('ignora los bloqueos al listar refugios y conserva el nombre', () => {
    const { refugios } = analizarPerimetro(anillos, [refugio('a', 400), bloqueo('b', { type: 'Point', coordinates: alNorte(10) })], []);
    expect(refugios).toEqual([{ id: 'a', nombre: 'Refugio a', anillo: 'EVACUACION', apto: true }]);
  });
});

describe('analizarPerimetro · unidades', () => {
  it('alerta de las unidades dentro de la zona caliente, y solo de ellas', () => {
    const unidades = [unidad('en-escena', 0), unidad('cerca', 90), unidad('tibia', 200), unidad('lejos', 2000, 'DISPONIBLE')];
    expect(analizarPerimetro(anillos, [], unidades).unidadesEnZonaCaliente).toEqual(['en-escena', 'cerca']);
  });

  it('sin unidades no hay alerta', () => {
    expect(analizarPerimetro(anillos, [], []).unidadesEnZonaCaliente).toEqual([]);
  });
});

describe('analizarPerimetro · bloqueos', () => {
  it('detecta los bloqueos que cruzan algún anillo, sean puntos, líneas o áreas', () => {
    const [lng, lat] = alNorte(300);
    const [lngF, latF] = alNorte(5000);
    const { bloqueosAfectados } = analizarPerimetro(
      anillos,
      [
        bloqueo('punto', { type: 'Point', coordinates: alNorte(450) }),
        bloqueo('linea', { type: 'LineString', coordinates: [[lng - 0.01, lat], [lng + 0.01, lat]] }),
        bloqueo('lejano', { type: 'Point', coordinates: [lngF, latF] }),
        bloqueo('area', { type: 'Polygon', coordinates: [[[lng - 0.001, lat - 0.001], [lng + 0.001, lat - 0.001], [lng, lat + 0.001], [lng - 0.001, lat - 0.001]]] }),
        refugio('refugio-dentro', 10),
      ],
      [],
    );
    expect(bloqueosAfectados).toEqual(['punto', 'linea', 'area']);
  });
});

describe('analizarPerimetro · sin anillos', () => {
  it('no inventa alertas ni bloqueos', () => {
    const r = analizarPerimetro([], [refugio('a', 10), bloqueo('b', { type: 'Point', coordinates: alNorte(1) })], [unidad('u', 0)]);
    expect(r.unidadesEnZonaCaliente).toEqual([]);
    expect(r.bloqueosAfectados).toEqual([]);
    expect(r.refugios[0]?.anillo).toBe('FUERA');
  });
});
