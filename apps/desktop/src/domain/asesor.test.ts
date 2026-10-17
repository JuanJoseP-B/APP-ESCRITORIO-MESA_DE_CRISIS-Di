import { describe, expect, it } from 'vitest';
import type { EstadoSla, Incidente, Llamada, RecomendacionAsesor, SnapshotAsesor, ZonaPublica } from '@argos/shared';
import {
  accionesDeRecomendacion,
  autorAsesor,
  claveAccion,
  construirSnapshot,
  separarAcciones,
  previsualizarRecomendacion,
  textoBitacoraAsesor,
  validarRecomendacion,
  type EntradaSnapshot,
} from './asesor';
import type { UnidadMapa } from './unidadesMapa';

const AHORA = Date.parse('2026-10-07T12:00:00Z');
const CENTRO = { lat: 1.2136, lng: -77.2811 };

const incidente: Incidente = {
  id: 'inc-gas-a3f',
  titulo: 'Fuga de gas en sector',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'FUGA_GAS',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [CENTRO.lng, CENTRO.lat] },
  timeline: [],
  creado_en: '2026-10-07T11:50:00Z',
};

const llamada = (id: string, incidenteId: string | null, creadoEn: string): Llamada => ({
  id,
  canal: '123',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: CENTRO,
  narrativa: 'Olor fuerte a gas en el edificio.',
  reportante: 'Rosa Pérez Quintero',
  callback: '3001112233',
  incidenteId,
  estadoValidacion: 'Confirmado',
  operadorId: null,
  creadoEn,
});

// 0,001° de latitud son ~111 m.
const unidad = (id: string, tipo: UnidadMapa['tipo'], estado: UnidadMapa['estado'], dLat: number, incidenteId: string | null = null): UnidadMapa => ({
  id,
  indicativo: id.toUpperCase(),
  tipo,
  estado,
  incidenteId,
  posicion: { lat: CENTRO.lat + dLat, lng: CENTRO.lng },
  atenuada: estado === 'INOPERATIVO',
});

const refugio = (id: string, nombre: string, dLat: number, actual: number, maxima: number): ZonaPublica => ({
  id,
  tipo: 'Refugio',
  nombre,
  geometria: { type: 'Point', coordinates: [CENTRO.lng, CENTRO.lat + dLat] },
  capacidad_actual: actual,
  capacidad_maxima: maxima,
});

const entrada = (extra: Partial<EntradaSnapshot> = {}): EntradaSnapshot => ({
  incidente,
  llamadas: [llamada('l1', incidente.id, '2026-10-07T11:51:00Z'), llamada('l2', 'otro', '2026-10-07T11:52:00Z'), llamada('l3', null, '2026-10-07T11:53:00Z')],
  unidades: [
    unidad('u01', 'Bomberos', 'DISPONIBLE', 0.005),
    unidad('m10', 'Ambulancia', 'INOPERATIVO', 0.002),
    unidad('p01', 'Policía', 'EN_RUTA', 0.01, incidente.id),
    unidad('m11', 'Ambulancia', 'DISPONIBLE', 0.02),
  ],
  zonas: [refugio('z-lejos', 'Colegio Central', 0.02, 10, 120), refugio('z-cerca', 'Coliseo Cercano', 0.002, 0, 100)],
  sla: new Map(),
  ahoraMs: AHORA,
  ...extra,
});

describe('construirSnapshot', () => {
  it('no incluye al reportante ni su callback', () => {
    const texto = JSON.stringify(construirSnapshot(entrada()));
    expect(texto).not.toContain('Rosa');
    expect(texto).not.toContain('3001112233');
    expect(texto).not.toMatch(/reportante|callback/);
  });

  it('deja fuera las unidades inoperativas y precalcula la distancia al incidente', () => {
    const s = construirSnapshot(entrada());
    expect(s.recursos.map((r) => r.id)).toEqual(['u01', 'p01', 'm11']);
    const u01 = s.recursos.find((r) => r.id === 'u01');
    expect(u01?.distanciaM).toBeGreaterThan(540);
    expect(u01?.distanciaM).toBeLessThan(570);
    expect(s.recursos.find((r) => r.id === 'p01')).toMatchObject({ estado: 'EN_RUTA', incidenteId: incidente.id });
  });

  it('cuenta solo las llamadas vinculadas y describe el incidente con la primera narrativa', () => {
    const s = construirSnapshot(entrada());
    expect(s.incidente).toMatchObject({
      id: incidente.id,
      codigo: 'A3F',
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      llamadasVinculadas: 1,
      minutosAbierto: 10,
      perimetroActual: null,
    });
    expect(s.incidente.descripcion).toBe('Fuga de gas en sector. Olor fuerte a gas en el edificio.');
    expect(s.generadoEn).toBe('2026-10-07T12:00:00.000Z');
  });

  it('clasifica los refugios contra el perímetro de protocolo (fuga de gas: 100/300/800 m)', () => {
    const s = construirSnapshot(entrada());
    expect(s.refugios.find((r) => r.id === 'z-cerca')).toMatchObject({ anillo: 'TIBIA', ocupacion: 0, capacidad: 100 });
    expect(s.refugios.find((r) => r.id === 'z-lejos')?.anillo).toBe('FUERA');
  });

  it('reporta los SLA vencidos del incidente y las unidades ajenas en zona caliente', () => {
    const vencido: EstadoSla = { recursoId: 'p01', hito: 'EN_ESCENA', transcurridoSeg: 700, limiteSeg: 600, nivel: 'VENCIDO' };
    const s = construirSnapshot(
      entrada({
        unidades: [unidad('u01', 'Bomberos', 'DISPONIBLE', 0.0003), unidad('p01', 'Policía', 'EN_RUTA', 0.01, incidente.id)],
        sla: new Map([['p01', vencido]]),
      }),
    );
    expect(s.contexto.slaVencidos).toEqual(['p01']);
    expect(s.contexto.unidadesEnZonaCaliente).toEqual(['u01']);
  });

  it('un incidente con perímetro propio conserva sus radios como perimetroActual', () => {
    const radios = { CALIENTE: 80, TIBIA: 200, EVACUACION: 400 };
    const s = construirSnapshot(
      entrada({ incidente: { ...incidente, perimetro: { centro: CENTRO, radios, origen: 'MANUAL', poligonoManual: null } } }),
    );
    expect(s.incidente.perimetroActual).toEqual(radios);
  });
});

describe('validarRecomendacion', () => {
  const snapshot: SnapshotAsesor = construirSnapshot(entrada());
  const buena: RecomendacionAsesor = {
    idRecomendacion: 'rec-12345678-aaaa',
    unidades: [
      { idRecurso: 'u01', rol: 'Control', etaMin: 1 },
      { idRecurso: 'm11', rol: 'Atención', etaMin: 3 },
    ],
    justificacion: 'Texto.',
    perimetroSugerido: { CALIENTE: 100, TIBIA: 300, EVACUACION: 800 },
    refugioSugeridoId: 'z-lejos',
    advertencias: [],
    confianza: 'ALTA',
  };

  it('acepta una recomendación coherente con el snapshot', () => {
    expect(validarRecomendacion(snapshot, buena)).toEqual({ valida: true });
  });

  it('rechaza un recurso que no existe en el snapshot', () => {
    const rec = { ...buena, unidades: [{ idRecurso: 'fantasma', rol: 'x', etaMin: 1 }] };
    expect(validarRecomendacion(snapshot, rec)).toMatchObject({ valida: false, motivo: 'RECURSO_INEXISTENTE', detalle: 'fantasma' });
  });

  it('rechaza una unidad inoperativa (fuera del snapshot) y una que no está disponible', () => {
    expect(validarRecomendacion(snapshot, { ...buena, unidades: [{ idRecurso: 'm10', rol: 'x', etaMin: 1 }] })).toMatchObject({
      motivo: 'RECURSO_INEXISTENTE',
    });
    expect(validarRecomendacion(snapshot, { ...buena, unidades: [{ idRecurso: 'p01', rol: 'x', etaMin: 1 }] })).toMatchObject({
      valida: false,
      motivo: 'RECURSO_NO_DISPONIBLE',
    });
  });

  it('rechaza una unidad repetida o una ETA negativa', () => {
    const u = { idRecurso: 'u01', rol: 'x', etaMin: 1 };
    expect(validarRecomendacion(snapshot, { ...buena, unidades: [u, u] })).toMatchObject({ motivo: 'RECURSO_REPETIDO' });
    expect(validarRecomendacion(snapshot, { ...buena, unidades: [{ ...u, etaMin: -1 }] })).toMatchObject({ motivo: 'ETA_INVALIDA' });
  });

  it('rechaza radios que no crecen', () => {
    for (const radios of [
      { CALIENTE: 300, TIBIA: 300, EVACUACION: 800 },
      { CALIENTE: 100, TIBIA: 800, EVACUACION: 300 },
      { CALIENTE: 0, TIBIA: 300, EVACUACION: 800 },
    ]) {
      expect(validarRecomendacion(snapshot, { ...buena, perimetroSugerido: radios })).toMatchObject({ valida: false, motivo: 'RADIOS_NO_CRECIENTES' });
    }
  });

  it('rechaza un refugio inexistente y una justificación de más de 600 caracteres', () => {
    expect(validarRecomendacion(snapshot, { ...buena, refugioSugeridoId: 'nada' })).toMatchObject({ motivo: 'REFUGIO_INEXISTENTE' });
    expect(validarRecomendacion(snapshot, { ...buena, justificacion: 'x'.repeat(601) })).toMatchObject({ motivo: 'JUSTIFICACION_LARGA' });
    expect(validarRecomendacion(snapshot, { ...buena, refugioSugeridoId: null })).toEqual({ valida: true });
  });
});

describe('acciones y bitácora del asesor', () => {
  const snapshot = construirSnapshot(entrada());
  const rec: RecomendacionAsesor = {
    idRecomendacion: 'abcd1234-ffff-4000-8000-000000000000',
    unidades: [
      { idRecurso: 'u01', rol: 'Control', etaMin: 1 },
      { idRecurso: 'm11', rol: 'Atención', etaMin: 3 },
    ],
    justificacion: 'Texto.',
    perimetroSugerido: { CALIENTE: 100, TIBIA: 300, EVACUACION: 800 },
    refugioSugeridoId: 'z-lejos',
    advertencias: [],
    confianza: 'MEDIA',
  };

  it('lista una acción por unidad, el perímetro y el refugio, con claves distintas', () => {
    const acciones = accionesDeRecomendacion(rec);
    expect(acciones.map(claveAccion)).toEqual(['despachar:u01', 'despachar:m11', 'perimetro', 'refugio:z-lejos']);
    expect(accionesDeRecomendacion({ ...rec, refugioSugeridoId: null }).map(claveAccion)).toEqual(['despachar:u01', 'despachar:m11', 'perimetro']);
  });

  it('registra el id de la recomendación, lo aceptado y lo rechazado', () => {
    const [u01, m11, perimetro, refugioA] = accionesDeRecomendacion(rec);
    const texto = textoBitacoraAsesor(snapshot, rec, [u01!, perimetro!], [m11!, refugioA!]);
    expect(texto).toBe(
      'Asesor táctico [abcd1234] · el operador aplicó la sugerencia en parte. Aceptado: despachar U01, perímetro 100/300/800 m. Rechazado: despachar M11, refugio Colegio Central.',
    );
  });

  it('una aplicación completa no rechaza nada y un descarte no acepta nada', () => {
    const todas = accionesDeRecomendacion(rec);
    expect(textoBitacoraAsesor(snapshot, rec, todas, [])).toContain('aplicó la sugerencia. Aceptado');
    expect(textoBitacoraAsesor(snapshot, rec, todas, [])).toContain('Rechazado: ninguna.');
    const descarte = textoBitacoraAsesor(snapshot, rec, [], todas);
    expect(descarte).toContain('descartó la sugerencia. Aceptado: ninguna.');
    expect(descarte).toContain('Rechazado: despachar U01');
  });

  it('separa lo marcado de lo omitido y rechaza despachar una unidad que ya no está libre', () => {
    const claves = (as: readonly Parameters<typeof claveAccion>[0][]) => as.map(claveAccion);
    const todas = new Set(accionesDeRecomendacion(rec).map(claveAccion));
    const libres = new Set(['u01', 'm11']);

    const completa = separarAcciones(rec, todas, libres);
    expect(claves(completa.aceptadas)).toEqual(['despachar:u01', 'despachar:m11', 'perimetro', 'refugio:z-lejos']);
    expect(completa.rechazadas).toEqual([]);

    const parcial = separarAcciones(rec, new Set(['despachar:u01', 'perimetro']), libres);
    expect(claves(parcial.aceptadas)).toEqual(['despachar:u01', 'perimetro']);
    expect(claves(parcial.rechazadas)).toEqual(['despachar:m11', 'refugio:z-lejos']);

    const ocupada = separarAcciones(rec, todas, new Set(['u01']));
    expect(claves(ocupada.aceptadas)).toEqual(['despachar:u01', 'perimetro', 'refugio:z-lejos']);
    expect(claves(ocupada.rechazadas)).toEqual(['despachar:m11']);

    const ninguna = separarAcciones(rec, new Set(), libres);
    expect(ninguna.aceptadas).toEqual([]);
    expect(ninguna.rechazadas).toHaveLength(4);
  });

  it('el autor indica el origen ASESOR y quién confirmó', () => {
    expect(autorAsesor('jefe@argos.test')).toBe('ASESOR · jefe@argos.test');
    expect(autorAsesor()).toBe('ASESOR');
  });
});

describe('previsualizarRecomendacion', () => {
  it('dibuja los tres anillos sugeridos y una línea por unidad hasta el incidente', () => {
    const snapshot = construirSnapshot(entrada());
    const previa = previsualizarRecomendacion(snapshot, {
      idRecomendacion: 'r',
      unidades: [
        { idRecurso: 'u01', rol: 'x', etaMin: 1 },
        { idRecurso: 'no-esta', rol: 'x', etaMin: 1 },
      ],
      justificacion: '',
      perimetroSugerido: { CALIENTE: 100, TIBIA: 300, EVACUACION: 800 },
      refugioSugeridoId: null,
      advertencias: [],
      confianza: 'ALTA',
    });
    expect(previa.perimetro.features.map((f) => f.properties.id)).toEqual(['CALIENTE', 'TIBIA', 'EVACUACION']);
    expect(previa.anillos.map((a) => a.radioM)).toEqual([100, 300, 800]);
    expect(previa.unidades.features).toHaveLength(1);
    const linea = previa.unidades.features[0]?.geometry;
    expect(linea).toMatchObject({ type: 'LineString' });
    expect(linea && 'coordinates' in linea ? linea.coordinates[1] : null).toEqual([CENTRO.lng, CENTRO.lat]);
  });
});
