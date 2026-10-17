import { describe, expect, it } from 'vitest';
import {
  PATRONES,
  SONIDOS,
  duracionPatron,
  gananciaMaestra,
  instantaneaSonora,
  normalizarVolumen,
  sonidoDeLlamada,
  sonidosDeCambios,
  type InstantaneaSonora,
} from './sonidos';

const VACIA: InstantaneaSonora = instantaneaSonora({ entrantes: [], unidadesVencidas: [], recursos: [], incidentes: [] });

describe('patrones', () => {
  it('todo sonido tiene un patrón breve, con notas audibles y ganancia acotada', () => {
    for (const sonido of SONIDOS) {
      const patron = PATRONES[sonido];
      expect(patron.length).toBeGreaterThan(0);
      expect(duracionPatron(patron)).toBeLessThanOrEqual(0.5);
      for (const nota of patron) {
        expect(nota.duracion).toBeGreaterThan(0);
        expect(nota.frecuencia).toBeGreaterThanOrEqual(200);
        expect(nota.frecuencia).toBeLessThanOrEqual(2000);
        expect(nota.ganancia).toBeGreaterThan(0);
        expect(nota.ganancia).toBeLessThanOrEqual(1);
      }
    }
  });

  it('P1 es un doble tono agudo, P2 un tono medio y P3/P4 uno suave', () => {
    const [p1, p2, suave] = [PATRONES.llamadaP1, PATRONES.llamadaP2, PATRONES.llamadaSuave];
    expect(p1).toHaveLength(2);
    expect(p1[1]?.inicio).toBeGreaterThanOrEqual((p1[0]?.inicio ?? 0) + (p1[0]?.duracion ?? 0));
    expect(p2).toHaveLength(1);
    expect(suave).toHaveLength(1);
    expect(p1[0]?.frecuencia).toBeGreaterThan(p2[0]?.frecuencia ?? 0);
    expect(p2[0]?.frecuencia).toBeGreaterThan(suave[0]?.frecuencia ?? 0);
    expect(suave[0]?.ganancia).toBeLessThan(p2[0]?.ganancia ?? 0);
  });

  it('el SLA vencido desciende, el despacho es un clic y el resuelto un acorde', () => {
    const sla = PATRONES.slaVencido[0];
    expect(sla?.hasta).toBeLessThan(sla?.frecuencia ?? 0);
    expect(duracionPatron(PATRONES.despacho)).toBeLessThanOrEqual(0.05);
    expect(PATRONES.resuelto).toHaveLength(3);
    expect(new Set(PATRONES.resuelto.map((n) => n.inicio)).size).toBe(1);
    expect(PATRONES.arranque).toHaveLength(1);
  });

  it('la prioridad de la llamada elige el sonido', () => {
    expect((['P1', 'P2', 'P3', 'P4'] as const).map(sonidoDeLlamada)).toEqual(['llamadaP1', 'llamadaP2', 'llamadaSuave', 'llamadaSuave']);
  });
});

describe('volumen', () => {
  it('se acota a 0–100 y lo que no es número vuelve al valor por defecto', () => {
    expect([-5, 0, 42.4, 100, 250].map(normalizarVolumen)).toEqual([0, 0, 42, 100, 100]);
    expect(normalizarVolumen(Number.NaN)).toBe(60);
  });

  it('en silencio la ganancia es 0 sea cual sea el volumen', () => {
    expect(gananciaMaestra(100, true)).toBe(0);
    expect(gananciaMaestra(50, false)).toBe(0.5);
    expect(gananciaMaestra(0, false)).toBe(0);
  });
});

describe('sonidosDeCambios', () => {
  it('la primera lectura es la base: lo que ya estaba no suena', () => {
    const cargada = instantaneaSonora({
      entrantes: [{ id: 'l1', prioridad: 'P1' }],
      unidadesVencidas: ['u1'],
      recursos: [{ id: 'u1', estado_actual: 'ASIGNADO', incidente_asignado_id: 'i1' }],
      incidentes: [{ id: 'i0', estado: 'Resuelto' }],
    });
    expect(sonidosDeCambios(null, cargada)).toEqual([]);
    expect(sonidosDeCambios(cargada, cargada)).toEqual([]);
  });

  it('varias llamadas nuevas dan un solo aviso, el de la más prioritaria', () => {
    const actual = instantaneaSonora({
      entrantes: [
        { id: 'l1', prioridad: 'P3' },
        { id: 'l2', prioridad: 'P2' },
      ],
      unidadesVencidas: [],
      recursos: [],
      incidentes: [],
    });
    expect(sonidosDeCambios(VACIA, actual)).toEqual(['llamadaP2']);
  });

  it('una llamada que sale de la bandeja no suena', () => {
    const con = instantaneaSonora({ entrantes: [{ id: 'l1', prioridad: 'P1' }], unidadesVencidas: [], recursos: [], incidentes: [] });
    expect(sonidosDeCambios(con, VACIA)).toEqual([]);
  });

  it('SLA vencido, incidente resuelto y despacho suenan una vez cada uno, del más urgente al menos', () => {
    const actual = instantaneaSonora({
      entrantes: [{ id: 'l9', prioridad: 'P1' }],
      unidadesVencidas: ['u1', 'u2'],
      recursos: [
        { id: 'u3', estado_actual: 'ASIGNADO', incidente_asignado_id: 'i1' },
        { id: 'u4', estado_actual: 'ASIGNADO', incidente_asignado_id: 'i1' },
        { id: 'u5', estado_actual: 'EN_RUTA', incidente_asignado_id: 'i1' },
      ],
      incidentes: [
        { id: 'i2', estado: 'Resuelto' },
        { id: 'i1', estado: 'Abierto' },
      ],
    });
    expect(sonidosDeCambios(VACIA, actual)).toEqual(['llamadaP1', 'slaVencido', 'resuelto', 'despacho']);
  });

  it('pasar de ASIGNADO a EN_RUTA no vuelve a sonar; reasignar a otro incidente sí', () => {
    const asignada = instantaneaSonora({ entrantes: [], unidadesVencidas: [], recursos: [{ id: 'u1', estado_actual: 'ASIGNADO', incidente_asignado_id: 'i1' }], incidentes: [] });
    const enRuta = instantaneaSonora({ entrantes: [], unidadesVencidas: [], recursos: [{ id: 'u1', estado_actual: 'EN_RUTA', incidente_asignado_id: 'i1' }], incidentes: [] });
    const reasignada = instantaneaSonora({ entrantes: [], unidadesVencidas: [], recursos: [{ id: 'u1', estado_actual: 'ASIGNADO', incidente_asignado_id: 'i2' }], incidentes: [] });
    expect(sonidosDeCambios(asignada, enRuta)).toEqual([]);
    expect(sonidosDeCambios(asignada, reasignada)).toEqual(['despacho']);
  });
});
