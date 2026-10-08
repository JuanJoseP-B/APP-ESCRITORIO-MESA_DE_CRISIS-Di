import { describe, expect, it } from 'vitest';
import type { EstadoIncidente, Incidente, TipoEmergencia } from '@argos/shared';
import { buscarDuplicados, coincidenciaTipo } from './duplicados';
import { distanciaM } from './geo';

/*
 * Ubicación de la llamada: Plaza de Nariño (Pasto), 1°12′52″N 77°16′42″O = 1.2145833333333, -77.278305555556
 * (Wikipedia, consultada el 2026-10-08: https://es.wikipedia.org/wiki/Plaza_de_Nari%C3%B1o_(Pasto)).
 * Los incidentes se colocan al norte a una distancia exacta en metros (1° de latitud ≈ 111 195 m).
 */
const PLAZA = { lat: 1.2145833333333, lng: -77.278305555556 };
const AHORA = Date.parse('2026-10-07T12:00:00Z');
const M_POR_GRADO = 111_195;

const alNorte = (metros: number) => ({ lat: PLAZA.lat + metros / M_POR_GRADO, lng: PLAZA.lng });

const inc = (
  id: string,
  opciones: { metros?: number; tipo?: TipoEmergencia | null; haceMin?: number; estado?: EstadoIncidente } = {},
): Incidente => {
  const { metros = 0, tipo = 'INCENDIO', haceMin = 4, estado = 'Abierto' } = opciones;
  const { lat, lng } = alNorte(metros);
  return {
    id,
    titulo: `Incidente ${id}`,
    nivel_criticidad: 'Medio',
    prioridad: 'P2',
    tipo,
    estado,
    geometria: { type: 'Point', coordinates: [lng, lat] },
    timeline: [{ timestamp: new Date(AHORA - haceMin * 60_000).toISOString(), descripcion: 'Registrado' }],
  };
};

const consulta = { tipo: 'INCENDIO', ubicacion: PLAZA } as const;
const ids = (r: readonly { incidenteId: string }[]) => r.map((c) => c.incidenteId);

describe('coincidenciaTipo', () => {
  it('1 si es igual, 0.5 si es de la misma familia, 0 si no', () => {
    expect(coincidenciaTipo('INCENDIO', 'INCENDIO')).toBe(1);
    expect(coincidenciaTipo('INCENDIO', 'FUGA_GAS')).toBe(0.5);
    expect(coincidenciaTipo('INUNDACION', 'CRECIENTE_SUBITA')).toBe(0.5);
    expect(coincidenciaTipo('INCENDIO', 'DESLIZAMIENTO')).toBe(0);
  });

  it('un incidente sin tipo no coincide con nada', () => {
    expect(coincidenciaTipo('INCENDIO', null)).toBe(0);
  });
});

describe('buscarDuplicados (F2-T2)', () => {
  it('mismo tipo a 120 m y 4 min: es candidato con puntaje ≥ 0.6', () => {
    const [c] = buscarDuplicados(consulta, [inc('a3f', { metros: 120, haceMin: 4 })], AHORA);
    expect(c?.incidenteId).toBe('a3f');
    expect(c?.puntaje).toBeGreaterThanOrEqual(0.6);
    // 0.5·(1−120/500) + 0.3·(1−4/30) + 0.2·1 = 0.84
    expect(c?.puntaje).toBeCloseTo(0.84, 2);
    expect(c?.distanciaM).toBeCloseTo(120, 0);
    expect(c?.minutosDesde).toBe(4);
    expect(c?.codigo).toBe('A3F');
  });

  it('a 800 m queda fuera, aunque sea del mismo tipo y recién abierto', () => {
    expect(buscarDuplicados(consulta, [inc('lejos', { metros: 800, haceMin: 0 })], AHORA)).toEqual([]);
  });

  it('un incidente resuelto se excluye', () => {
    expect(buscarDuplicados(consulta, [inc('r', { metros: 10, estado: 'Resuelto' })], AHORA)).toEqual([]);
    expect(ids(buscarDuplicados(consulta, [inc('c', { metros: 10, estado: 'Contenido' })], AHORA))).toEqual(['c']);
  });

  it('de otro tipo no familiar a 50 m, con 20 min de antigüedad, queda por debajo de 0.6', () => {
    // 0.5·(1−50/500) + 0.3·(1−20/30) + 0.2·0 = 0.55. Con menos de 15 min el puntaje sube de 0.6 solo por cercanía y recencia.
    expect(buscarDuplicados(consulta, [inc('x', { metros: 50, tipo: 'DESLIZAMIENTO', haceMin: 20 })], AHORA)).toEqual([]);
  });

  it('de la misma familia puntúa 0.1 por el tipo y suma menos que el mismo tipo', () => {
    const [igual, familia] = buscarDuplicados(
      consulta,
      [inc('familia', { metros: 100, tipo: 'FUGA_GAS' }), inc('igual', { metros: 100, tipo: 'INCENDIO' })],
      AHORA,
    );
    expect(igual?.incidenteId).toBe('igual');
    expect((igual?.puntaje ?? 0) - (familia?.puntaje ?? 0)).toBeCloseTo(0.1, 5);
  });

  it('un incidente sin tipo se evalúa con coincidencia 0', () => {
    const [c] = buscarDuplicados(consulta, [inc('sin-tipo', { metros: 50, tipo: null, haceMin: 2 })], AHORA);
    // 0.5·0.9 + 0.3·(1−2/30) + 0 = 0.73
    expect(c?.puntaje).toBeCloseTo(0.73, 2);
  });

  it('devuelve como máximo 3, de mayor a menor puntaje', () => {
    const lista = [
      inc('d', { metros: 300 }),
      inc('a', { metros: 20 }),
      inc('c', { metros: 200 }),
      inc('b', { metros: 100 }),
      inc('e', { metros: 400, haceMin: 25 }),
    ];
    const r = buscarDuplicados(consulta, lista, AHORA);
    expect(ids(r)).toEqual(['a', 'b', 'c']);
    expect(r.map((c) => c.puntaje)).toEqual([...r.map((c) => c.puntaje)].sort((x, y) => y - x));
  });

  it('con un perímetro, el incidente se ubica en su centro', () => {
    const base = inc('p', { metros: 900 });
    const conPerimetro: Incidente = {
      ...base,
      perimetro: { centro: alNorte(30), radios: { CALIENTE: 100, TIBIA: 300, EVACUACION: 500 }, origen: 'AUTO', poligonoManual: null },
    };
    expect(ids(buscarDuplicados(consulta, [conPerimetro], AHORA))).toEqual(['p']);
  });

  it('la recencia vale 0 pasada la ventana y los parámetros son configurables', () => {
    const viejo = inc('viejo', { metros: 0, haceMin: 60 });
    // 0.5 + 0 + 0.2 = 0.7 ≥ 0.6
    expect(buscarDuplicados(consulta, [viejo], AHORA)[0]?.puntaje).toBeCloseTo(0.7, 5);
    expect(buscarDuplicados(consulta, [viejo], AHORA, { radioMaxM: 500, ventanaMin: 30, umbral: 0.8, maxCandidatos: 3 })).toEqual([]);
  });

  it('un incidente abierto en el futuro (reloj adelantado) no da recencia negativa', () => {
    const [c] = buscarDuplicados(consulta, [inc('f', { metros: 0, haceMin: -5 })], AHORA);
    expect(c?.minutosDesde).toBe(0);
    expect(c?.puntaje).toBeCloseTo(1, 5);
  });

  it('la distancia usada es la de geo.distanciaM', () => {
    const [c] = buscarDuplicados(consulta, [inc('z', { metros: 250 })], AHORA);
    expect(c?.distanciaM).toBeCloseTo(distanciaM(PLAZA, alNorte(250)), 6);
  });
});
