import { describe, expect, it } from 'vitest';
import { PROTOCOLOS_PERIMETRO, TIPOS_EMERGENCIA, type RecomendacionAsesor, type SnapshotAsesor } from '@argos/shared';
import { DICCIONARIOS, traducir } from '../i18n/idioma';
import type { Traductor } from '../i18n/IdiomaProvider';
import { MAX_JUSTIFICACION, validarRecomendacion } from './asesor';
import { NECESIDADES_POR_TIPO, confianzaPorCobertura, crearMotorReglas, etaMinutos, recomendarPorReglas } from './motorReglas';
import { VELOCIDAD_MS } from './movimiento';

const ts = (idioma: 'es' | 'en'): Traductor => (clave, params) => traducir(DICCIONARIOS[idioma], clave, params);
const t = ts('es');
const generarId = () => 'rec-fija';
const CENTRO = { lat: 1.2136, lng: -77.2811 };

type Recursos = SnapshotAsesor['recursos'];
type Refugios = SnapshotAsesor['refugios'];

const recurso = (
  id: string,
  tipo: Recursos[number]['tipo'],
  distanciaM: number,
  estado: Recursos[number]['estado'] = 'DISPONIBLE',
  incidenteId: string | null = null,
): Recursos[number] => ({ id, indicativo: id.toUpperCase(), tipo, estado, incidenteId, ubicacion: CENTRO, distanciaM });

const refugio = (id: string, ocupacion: number, capacidad: number, anillo: Refugios[number]['anillo'] = 'FUERA'): Refugios[number] => ({
  id,
  nombre: `Refugio ${id}`,
  ubicacion: CENTRO,
  ocupacion,
  capacidad,
  anillo,
});

const snapshot = (extra: { tipo?: SnapshotAsesor['incidente']['tipo']; recursos?: Recursos; refugios?: Refugios; contexto?: Partial<SnapshotAsesor['contexto']> } = {}): SnapshotAsesor => ({
  version: 1,
  generadoEn: '2026-10-07T12:00:00.000Z',
  incidente: {
    id: 'inc-1',
    codigo: 'IN1',
    tipo: extra.tipo === undefined ? 'FUGA_GAS' : extra.tipo,
    prioridad: 'P1',
    ubicacion: CENTRO,
    descripcion: 'Fuga de gas en sector',
    llamadasVinculadas: 2,
    minutosAbierto: 9,
    perimetroActual: null,
  },
  recursos: extra.recursos ?? [],
  refugios: extra.refugios ?? [],
  contexto: { slaVencidos: [], unidadesEnZonaCaliente: [], ...extra.contexto },
});

const recomendar = (s: SnapshotAsesor, traductor: Traductor = t): RecomendacionAsesor => {
  const r = recomendarPorReglas(s, { t: traductor, generarId });
  if (!r.ok) throw new Error(`Se esperaba una recomendación y fue ${r.error}`);
  return r.recomendacion;
};

describe('NECESIDADES_POR_TIPO', () => {
  it('cubre todos los tipos de emergencia con al menos un tipo de unidad', () => {
    for (const tipo of TIPOS_EMERGENCIA) expect(NECESIDADES_POR_TIPO[tipo].length).toBeGreaterThan(0);
  });

  it('fija los ejemplos del enunciado', () => {
    expect([...NECESIDADES_POR_TIPO.FUGA_GAS].sort()).toEqual(['Ambulancia', 'Bomberos']);
    expect([...NECESIDADES_POR_TIPO.DESLIZAMIENTO].sort()).toEqual(['Ambulancia', 'Bomberos', 'Policía']);
  });
});

describe('recomendarPorReglas · unidades', () => {
  it('elige la unidad disponible más cercana de cada tipo requerido', () => {
    const rec = recomendar(
      snapshot({
        recursos: [
          recurso('b-lejos', 'Bomberos', 900),
          recurso('b-cerca', 'Bomberos', 300),
          recurso('m-lejos', 'Ambulancia', 1500),
          recurso('m-cerca', 'Ambulancia', 700),
          recurso('p01', 'Policía', 100),
        ],
      }),
    );
    expect(rec.unidades.map((u) => u.idRecurso)).toEqual(['b-cerca', 'm-cerca']);
    expect(rec.idRecomendacion).toBe('rec-fija');
  });

  it('calcula la ETA con la velocidad del tipo y nunca baja de 1 minuto', () => {
    const rec = recomendar(snapshot({ recursos: [recurso('b01', 'Bomberos', 2000), recurso('m01', 'Ambulancia', 50)] }));
    expect(rec.unidades.find((u) => u.idRecurso === 'b01')?.etaMin).toBe(Math.ceil(2000 / VELOCIDAD_MS.Bomberos / 60));
    expect(rec.unidades.find((u) => u.idRecurso === 'm01')?.etaMin).toBe(1);
    expect(etaMinutos('Policía', 16 * 60 * 5)).toBe(5);
  });

  it('ignora las unidades ocupadas y desempata por indicativo', () => {
    const rec = recomendar(
      snapshot({
        recursos: [
          recurso('b02', 'Bomberos', 400),
          recurso('b01', 'Bomberos', 400),
          recurso('b-ocupada', 'Bomberos', 10, 'EN_RUTA', 'otro'),
          recurso('m01', 'Ambulancia', 400),
        ],
      }),
    );
    expect(rec.unidades.map((u) => u.idRecurso)).toEqual(['b01', 'm01']);
  });

  it('no repite un tipo que el incidente ya tiene asignado', () => {
    const rec = recomendar(
      snapshot({ recursos: [recurso('b-asig', 'Bomberos', 50, 'ASIGNADO', 'inc-1'), recurso('b-libre', 'Bomberos', 300), recurso('m01', 'Ambulancia', 400)] }),
    );
    expect(rec.unidades.map((u) => u.idRecurso)).toEqual(['m01']);
    expect(rec.confianza).toBe('ALTA');
  });

  it('el rol sale del tipo de unidad, en el idioma pedido', () => {
    const s = snapshot({ recursos: [recurso('b01', 'Bomberos', 100)] });
    expect(recomendar(s).unidades[0]?.rol).toBe('Control y rescate');
    expect(recomendar(s, ts('en')).unidades[0]?.rol).toBe('Control and rescue');
  });
});

describe('recomendarPorReglas · perímetro y refugio', () => {
  // Con las dos unidades que exige una fuga de gas, las únicas advertencias posibles son las del refugio.
  const unidades = [recurso('b01', 'Bomberos', 100), recurso('m01', 'Ambulancia', 100)];

  it('sugiere el perímetro del protocolo del tipo, sin compartir el objeto', () => {
    for (const tipo of TIPOS_EMERGENCIA) {
      const rec = recomendar(snapshot({ tipo }));
      expect(rec.perimetroSugerido).toEqual(PROTOCOLOS_PERIMETRO[tipo]);
      expect(rec.perimetroSugerido).not.toBe(PROTOCOLOS_PERIMETRO[tipo]);
    }
  });

  it('elige el refugio fuera de los anillos con más cupo libre', () => {
    const rec = recomendar(
      snapshot({ recursos: unidades, refugios: [refugio('chico', 20, 100), refugio('grande', 50, 300), refugio('dentro', 0, 1000, 'TIBIA'), refugio('lleno', 100, 100)] }),
    );
    expect(rec.refugioSugeridoId).toBe('grande');
    // El refugio lleno no se sugiere, pero sí se avisa de que está al límite.
    expect(rec.advertencias).toEqual(['Refugio lleno está al 100 % de su aforo.']);
  });

  it('prefiere uno fuera de todos los anillos aunque tenga menos cupo que uno en el anillo de evacuación', () => {
    const rec = recomendar(snapshot({ refugios: [refugio('fuera', 0, 50), refugio('evac', 0, 500, 'EVACUACION')] }));
    expect(rec.refugioSugeridoId).toBe('fuera');
  });

  it('si solo hay refugios en el anillo de evacuación, sugiere el de más cupo y lo advierte', () => {
    const rec = recomendar(
      snapshot({ recursos: unidades, refugios: [refugio('a', 0, 100, 'EVACUACION'), refugio('b', 0, 300, 'EVACUACION'), refugio('c', 0, 900, 'TIBIA')] }),
    );
    expect(rec.refugioSugeridoId).toBe('b');
    expect(rec.advertencias).toEqual(['Refugio b está dentro de la zona de evacuación: no hay un refugio apto fuera del perímetro.']);
  });

  it('sin refugio apto no sugiere ninguno y lo advierte', () => {
    const rec = recomendar(snapshot({ refugios: [refugio('dentro', 0, 100, 'CALIENTE'), refugio('tibio', 0, 100, 'TIBIA'), refugio('lleno', 50, 50)] }));
    expect(rec.refugioSugeridoId).toBeNull();
    expect(rec.advertencias).toContain('Ningún refugio apto tiene cupo.');
  });
});

describe('recomendarPorReglas · advertencias y confianza', () => {
  it('avisa del tipo de unidad que no tiene disponibles', () => {
    const rec = recomendar(snapshot({ recursos: [recurso('b01', 'Bomberos', 100)], refugios: [refugio('r', 0, 100)] }));
    expect(rec.advertencias).toEqual(['No hay unidad de Ambulancia disponible.']);
  });

  it('avisa de los refugios cerca del límite, de los SLA vencidos y de las unidades en zona caliente', () => {
    const rec = recomendar(
      snapshot({
        recursos: [recurso('b01', 'Bomberos', 100), recurso('m01', 'Ambulancia', 100), recurso('p07', 'Policía', 30, 'EN_RUTA', 'inc-1')],
        refugios: [refugio('r1', 85, 100)],
        contexto: { slaVencidos: ['p07'], unidadesEnZonaCaliente: ['b01'] },
      }),
    );
    expect(rec.advertencias).toEqual([
      'B01 está en zona caliente y no atiende este incidente.',
      'SLA vencido en P07.',
      'Refugio r1 está al 85 % de su aforo.',
    ]);
    expect(rec.refugioSugeridoId).toBe('r1');
  });

  it('la confianza depende de cuántas necesidades quedan cubiertas', () => {
    expect(confianzaPorCobertura(3, 3)).toBe('ALTA');
    expect(confianzaPorCobertura(2, 3)).toBe('MEDIA');
    expect(confianzaPorCobertura(1, 2)).toBe('MEDIA');
    expect(confianzaPorCobertura(1, 3)).toBe('BAJA');
    expect(confianzaPorCobertura(0, 2)).toBe('BAJA');
    expect(recomendar(snapshot({ recursos: [recurso('b01', 'Bomberos', 1), recurso('m01', 'Ambulancia', 1)] })).confianza).toBe('ALTA');
    expect(recomendar(snapshot({ recursos: [recurso('b01', 'Bomberos', 1)] })).confianza).toBe('MEDIA');
    expect(recomendar(snapshot({ tipo: 'DESLIZAMIENTO', recursos: [recurso('b01', 'Bomberos', 1)] })).confianza).toBe('BAJA');
    expect(recomendar(snapshot()).confianza).toBe('BAJA');
  });
});

describe('recomendarPorReglas · justificación y errores', () => {
  const completo = snapshot({
    recursos: [recurso('b01', 'Bomberos', 300), recurso('m01', 'Ambulancia', 700)],
    refugios: [refugio('coliseo', 45, 200)],
  });

  it('son tres frases con plantillas en español', () => {
    expect(recomendar(completo).justificacion).toBe(
      'Fuga de gas P1, abierto hace 9 min. Llamadas vinculadas: 2. ' +
        'Se propone despachar B01 (Control y rescate), M01 (Atención prehospitalaria): la unidad libre más cercana de cada tipo que falta. ' +
        'Perímetro del protocolo: 100/300/800 m; refugio sugerido: Refugio coliseo (cupo libre: 155).',
    );
  });

  it('la misma recomendación se redacta en inglés', () => {
    const texto = recomendar(completo, ts('en')).justificacion;
    expect(texto).toContain('Gas leak P1, open for 9 min.');
    expect(texto).toContain('Dispatching B01 (Control and rescue)');
    expect(texto).toContain('Protocol perimeter: 100/300/800 m; suggested shelter');
  });

  it('dice cuándo no hay nada que despachar y cuándo no hay unidades', () => {
    expect(recomendar(snapshot({ recursos: [recurso('b','Bomberos',1,'EN_ESCENA','inc-1'), recurso('m','Ambulancia',1,'EN_ESCENA','inc-1')] })).justificacion).toContain('ya están asignados');
    expect(recomendar(snapshot()).justificacion).toContain('No hay unidades libres');
  });

  it('nunca pasa de 600 caracteres', () => {
    const largo = snapshot({ refugios: [{ ...refugio('x', 0, 10), nombre: 'N'.repeat(900) }] });
    expect(recomendar(largo).justificacion.length).toBeLessThanOrEqual(MAX_JUSTIFICACION);
  });

  it('un incidente sin tipo no admite recomendación', () => {
    const r = recomendarPorReglas(snapshot({ tipo: null }), { t, generarId });
    expect(r).toMatchObject({ ok: false, error: 'SIN_RECOMENDACION' });
  });

  it('lo que recomienda siempre pasa validarRecomendacion', () => {
    for (const tipo of TIPOS_EMERGENCIA) {
      const s = snapshot({
        tipo,
        recursos: [recurso('b01', 'Bomberos', 100), recurso('m01', 'Ambulancia', 200), recurso('p01', 'Policía', 300)],
        refugios: [refugio('r', 10, 100)],
      });
      expect(validarRecomendacion(s, recomendar(s))).toEqual({ valida: true });
    }
  });

  it('el motor cumple MotorAsesor: recomendar(snapshot) es asíncrono y usa el generador de ids', async () => {
    const motor = crearMotorReglas({ t, generarId });
    const r = await motor.recomendar(completo);
    expect(r.ok && r.recomendacion.idRecomendacion).toBe('rec-fija');
  });

  it('por defecto genera un UUID distinto en cada recomendación', () => {
    const [a, b] = [recomendarPorReglas(completo, { t }), recomendarPorReglas(completo, { t })];
    const id = (r: typeof a) => (r.ok ? r.recomendacion.idRecomendacion : '');
    expect(id(a)).toMatch(/^[0-9a-f-]{36}$/);
    expect(id(a)).not.toBe(id(b));
  });
});
