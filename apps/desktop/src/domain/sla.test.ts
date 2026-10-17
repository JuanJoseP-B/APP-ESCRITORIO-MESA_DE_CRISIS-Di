import { describe, expect, it } from 'vitest';
import type { EstadoRecurso, EventoRecurso, Incidente, Recurso } from '@argos/shared';
import { calcularSla, formatearCronometro, resumirSla, slaDeRecursos, vencimientosNuevos } from './sla';

const T0 = Date.parse('2026-10-08T10:00:00Z');
const ev = (n: number, recursoId: string, hacia: EstadoRecurso, seg: number): EventoRecurso => ({
  id: `e${n}`,
  recursoId,
  incidenteId: 'i1',
  desde: 'DISPONIBLE',
  hacia,
  origen: 'MANUAL',
  creadoEn: new Date(T0 + seg * 1000).toISOString(),
});
const asignado = [ev(1, 'r1', 'ASIGNADO', 0)];

describe('calcularSla · hito EN_RUTA (P1: 120 s, alerta al 80 %)', () => {
  it('asignado hace 90 s → EN_TIEMPO', () => {
    expect(calcularSla('r1', asignado, 'P1', T0 + 90_000)).toEqual({
      recursoId: 'r1',
      hito: 'EN_RUTA',
      transcurridoSeg: 90,
      limiteSeg: 120,
      nivel: 'EN_TIEMPO',
    });
  });

  it('a 100 s → ALERTA, y desde los 96 s (80 %) ya lo es', () => {
    expect(calcularSla('r1', asignado, 'P1', T0 + 100_000).nivel).toBe('ALERTA');
    expect(calcularSla('r1', asignado, 'P1', T0 + 96_000).nivel).toBe('ALERTA');
    expect(calcularSla('r1', asignado, 'P1', T0 + 95_000).nivel).toBe('EN_TIEMPO');
  });

  it('a 121 s → VENCIDO; justo en el límite todavía no', () => {
    expect(calcularSla('r1', asignado, 'P1', T0 + 121_000).nivel).toBe('VENCIDO');
    expect(calcularSla('r1', asignado, 'P1', T0 + 120_000).nivel).toBe('ALERTA');
  });

  it('cada prioridad usa su propio límite', () => {
    const limites = (['P1', 'P2', 'P3', 'P4'] as const).map((p) => calcularSla('r1', asignado, p, T0).limiteSeg);
    expect(limites).toEqual([120, 180, 300, 600]);
  });
});

describe('calcularSla · hito EN_ESCENA', () => {
  const enRuta = [...asignado, ev(2, 'r1', 'EN_RUTA', 60)];

  it('tras salir espera la llegada contando desde la asignación (P1: 600 s)', () => {
    expect(calcularSla('r1', enRuta, 'P1', T0 + 300_000)).toEqual({
      recursoId: 'r1',
      hito: 'EN_ESCENA',
      transcurridoSeg: 300,
      limiteSeg: 600,
      nivel: 'EN_TIEMPO',
    });
    expect(calcularSla('r1', enRuta, 'P1', T0 + 480_000).nivel).toBe('ALERTA');
    expect(calcularSla('r1', enRuta, 'P1', T0 + 601_000).nivel).toBe('VENCIDO');
  });
});

describe('calcularSla · NO_APLICA', () => {
  const sinSla = { hito: null, transcurridoSeg: 0, limiteSeg: null, nivel: 'NO_APLICA' };

  it('en escena no hay SLA, por tarde que sea', () => {
    const llego = [...asignado, ev(2, 'r1', 'EN_RUTA', 60), ev(3, 'r1', 'EN_ESCENA', 200)];
    expect(calcularSla('r1', llego, 'P1', T0 + 9_999_000)).toMatchObject(sinSla);
  });

  it('un despacho cancelado o una unidad inoperativa no cuentan', () => {
    expect(calcularSla('r1', [...asignado, ev(2, 'r1', 'DISPONIBLE', 30)], 'P1', T0 + 500_000)).toMatchObject(sinSla);
    expect(calcularSla('r1', [...asignado, ev(2, 'r1', 'INOPERATIVO', 30)], 'P1', T0 + 500_000)).toMatchObject(sinSla);
  });

  it('sin despacho o sin eventos de esa unidad no aplica', () => {
    expect(calcularSla('r1', [], 'P1', T0)).toMatchObject(sinSla);
    expect(calcularSla('r2', asignado, 'P1', T0)).toMatchObject(sinSla);
  });

  it('un nuevo despacho reinicia el cronómetro con el último ASIGNADO', () => {
    const dos = [...asignado, ev(2, 'r1', 'EN_ESCENA', 100), ev(3, 'r1', 'DISPONIBLE', 200), ev(4, 'r1', 'ASIGNADO', 1000)];
    expect(calcularSla('r1', dos, 'P1', T0 + 1_030_000)).toMatchObject({ hito: 'EN_RUTA', transcurridoSeg: 30, nivel: 'EN_TIEMPO' });
  });

  it('ordena los eventos por hora aunque lleguen desordenados y no cuenta tiempo negativo', () => {
    expect(calcularSla('r1', [ev(2, 'r1', 'EN_RUTA', 60), ...asignado], 'P1', T0 + 10_000)).toMatchObject({ hito: 'EN_ESCENA' });
    expect(calcularSla('r1', asignado, 'P1', T0 - 5_000).transcurridoSeg).toBe(0);
  });
});

const recurso = (id: string, estado: EstadoRecurso, incidente: string | null): Recurso => ({
  id,
  tipo: 'Ambulancia',
  estado_actual: estado,
  incidente_asignado_id: incidente,
});
const incidente = (id: string, prioridad: Incidente['prioridad']): Incidente =>
  ({ id, prioridad, titulo: id, nivel_criticidad: 'Crítico', tipo: 'FUGA_GAS', estado: 'Abierto', timeline: [], creado_en: '' }) as unknown as Incidente;

describe('slaDeRecursos y resumirSla', () => {
  const recursos = [
    recurso('r1', 'ASIGNADO', 'i1'),
    recurso('r2', 'EN_RUTA', 'i2'),
    recurso('r3', 'EN_ESCENA', 'i1'),
    recurso('r4', 'DISPONIBLE', null),
  ];
  const eventos = [
    ev(1, 'r1', 'ASIGNADO', 0),
    ev(2, 'r2', 'ASIGNADO', 0),
    ev(3, 'r2', 'EN_RUTA', 10),
    ev(4, 'r3', 'ASIGNADO', 0),
    ev(5, 'r3', 'EN_ESCENA', 50),
  ];
  const incidentes = [incidente('i1', 'P1'), incidente('i2', 'P2')];

  it('solo calcula las unidades con despacho en curso, con la prioridad de su incidente', () => {
    const mapa = slaDeRecursos(recursos, eventos, incidentes, T0 + 130_000);
    expect([...mapa.keys()]).toEqual(['r1', 'r2']);
    expect(mapa.get('r1')).toMatchObject({ nivel: 'VENCIDO', limiteSeg: 120 });
    expect(mapa.get('r2')).toMatchObject({ nivel: 'EN_TIEMPO', limiteSeg: 900, hito: 'EN_ESCENA' });
  });

  it('un incidente resuelto no corre contra el reloj: sus unidades asignadas no cuentan en el SLA', () => {
    const cerrados = [{ ...incidente('i1', 'P1'), estado: 'Resuelto' as const }, incidente('i2', 'P2')];
    const mapa = slaDeRecursos(recursos, eventos, cerrados, T0 + 130_000);
    expect([...mapa.keys()]).toEqual(['r2']);
    expect(resumirSla(recursos, mapa)).toMatchObject({ vencidos: 0, nivel: 'EN_TIEMPO' });
  });

  it('el resumen cuenta vencidos y alertas, toma el nivel más grave y lista incidentes y unidades afectados', () => {
    const resumen = resumirSla(recursos, slaDeRecursos(recursos, eventos, incidentes, T0 + 130_000));
    expect(resumen).toMatchObject({ vencidos: 1, alertas: 0, nivel: 'VENCIDO', unidadesVencidas: ['r1'] });
    expect([...resumen.incidentesEnRiesgo]).toEqual(['i1']);
  });

  it('un incidente con una unidad solo en ALERTA también está en riesgo, y mezclar niveles da el más grave', () => {
    const mezcla = [recurso('r1', 'ASIGNADO', 'i1'), recurso('r2', 'ASIGNADO', 'i2')];
    const evs = [ev(1, 'r1', 'ASIGNADO', 0), ev(2, 'r2', 'ASIGNADO', 50)];
    const resumen = resumirSla(mezcla, slaDeRecursos(mezcla, evs, incidentes, T0 + 125_000));
    expect(resumen).toMatchObject({ vencidos: 1, alertas: 0, nivel: 'VENCIDO' });
    const resumen2 = resumirSla(mezcla, slaDeRecursos(mezcla, evs, incidentes, T0 + 100_000));
    expect(resumen2).toMatchObject({ vencidos: 0, alertas: 1, nivel: 'ALERTA' });
    expect([...resumen2.incidentesEnRiesgo]).toEqual(['i1']);
  });

  it('sin SLA en curso el nivel es NO_APLICA; con solo una alerta, ALERTA', () => {
    expect(resumirSla(recursos, new Map())).toMatchObject({ vencidos: 0, alertas: 0, nivel: 'NO_APLICA' });
    expect(resumirSla(recursos, slaDeRecursos(recursos, eventos, incidentes, T0 + 100_000))).toMatchObject({
      vencidos: 0,
      alertas: 1,
      nivel: 'ALERTA',
    });
  });
});

describe('vencimientosNuevos', () => {
  it('solo devuelve lo que antes no estaba vencido', () => {
    expect(vencimientosNuevos(new Set(['a']), ['a', 'b', 'c'])).toEqual(['b', 'c']);
    expect(vencimientosNuevos(new Set(), [])).toEqual([]);
    expect(vencimientosNuevos(new Set(['a']), ['a'])).toEqual([]);
  });
});

describe('formatearCronometro', () => {
  it('da mm:ss con ceros a la izquierda', () => {
    expect(formatearCronometro(0)).toBe('00:00');
    expect(formatearCronometro(65.9)).toBe('01:05');
    expect(formatearCronometro(4500)).toBe('75:00');
    expect(formatearCronometro(-3)).toBe('00:00');
  });
});
