import { describe, expect, it } from 'vitest';
import { CANALES_LLAMADA, PRIORIDADES, esTipoEmergencia } from '@argos/shared';
import { distanciaM } from './geo';
import { DURACION_ESCENARIO_SEG, ESCENARIOS, ESCENARIO_INICIAL, GUION_CRISIS, IDS_ESCENARIO, TRAFICO_ESCENARIO, eventosEntre, eventosHasta, type Guion } from './escenario';

describe('GUION_CRISIS', () => {
  it('dura unos 8 minutos y sus eventos están ordenados dentro de ese lapso', () => {
    expect(DURACION_ESCENARIO_SEG).toBe(480);
    const tiempos = GUION_CRISIS.map((e) => e.tSeg);
    expect(tiempos).toEqual([...tiempos].sort((a, b) => a - b));
    expect(tiempos.every((t) => t > 0 && t < DURACION_ESCENARIO_SEG)).toBe(true);
    expect(new Set(GUION_CRISIS.map((e) => e.id)).size).toBe(GUION_CRISIS.length);
  });

  it('trae una fuga de gas con dos llamadas duplicadas, un deslizamiento y un aviso de sensor', () => {
    const gas = GUION_CRISIS.filter((e) => e.llamada.tipo === 'FUGA_GAS');
    expect(gas).toHaveLength(3);
    expect(new Set(gas.map((e) => e.llamada.canal)).size).toBeGreaterThan(1);
    expect(GUION_CRISIS.filter((e) => e.llamada.tipo === 'DESLIZAMIENTO')).toHaveLength(1);
    expect(GUION_CRISIS.filter((e) => e.llamada.canal === 'SENSOR')).toHaveLength(1);
  });

  it('las llamadas duplicadas caen a menos de 50 m de la primera y en pocos minutos', () => {
    const [primera, ...resto] = GUION_CRISIS.filter((e) => e.llamada.tipo === 'FUGA_GAS');
    expect(primera).toBeDefined();
    expect(resto).toHaveLength(2);
    for (const e of resto) {
      expect(distanciaM(primera!.llamada.ubicacion, e.llamada.ubicacion)).toBeLessThan(50);
      expect(e.tSeg - primera!.tSeg).toBeLessThan(5 * 60);
    }
  });

  it('el resto de eventos queda lejos de la fuga de gas, para no confundirse con un duplicado', () => {
    const gas = GUION_CRISIS.find((e) => e.llamada.tipo === 'FUGA_GAS')!;
    for (const e of GUION_CRISIS.filter((x) => x.llamada.tipo !== 'FUGA_GAS')) {
      expect(distanciaM(gas.llamada.ubicacion, e.llamada.ubicacion)).toBeGreaterThan(500);
    }
  });

  it('usa solo valores válidos del catálogo y ubicaciones en Pasto', () => {
    for (const { llamada } of GUION_CRISIS) {
      expect(esTipoEmergencia(llamada.tipo)).toBe(true);
      expect(CANALES_LLAMADA).toContain(llamada.canal);
      expect(PRIORIDADES).toContain(llamada.prioridad);
      expect(llamada.ubicacion.lat).toBeGreaterThan(1.1);
      expect(llamada.ubicacion.lat).toBeLessThan(1.3);
      expect(llamada.ubicacion.lng).toBeGreaterThan(-77.4);
      expect(llamada.ubicacion.lng).toBeLessThan(-77.2);
    }
  });
});

describe('eventosHasta', () => {
  const desordenado: Guion = [GUION_CRISIS[3]!, GUION_CRISIS[0]!, GUION_CRISIS[1]!];

  it('no devuelve nada antes del primer evento', () => {
    expect(eventosHasta(GUION_CRISIS, 0)).toEqual([]);
    expect(eventosHasta(GUION_CRISIS, -5)).toEqual([]);
    expect(eventosHasta(GUION_CRISIS, 19.9)).toEqual([]);
  });

  it('incluye el evento justo en su segundo', () => {
    expect(eventosHasta(GUION_CRISIS, 20).map((e) => e.id)).toEqual(['esc-gas-1']);
  });

  it('acumula los eventos transcurridos', () => {
    expect(eventosHasta(GUION_CRISIS, 150).map((e) => e.id)).toEqual(['esc-gas-1', 'esc-gas-2', 'esc-gas-3']);
    expect(eventosHasta(GUION_CRISIS, DURACION_ESCENARIO_SEG)).toHaveLength(GUION_CRISIS.length);
  });

  it('devuelve en orden cronológico aunque el guion no lo esté, sin mutarlo', () => {
    expect(eventosHasta(desordenado, 1000).map((e) => e.tSeg)).toEqual([20, 75, 230]);
    expect(desordenado.map((e) => e.tSeg)).toEqual([230, 20, 75]);
  });
});

describe('eventosEntre', () => {
  it('devuelve los eventos del tramo: exclusivo al inicio, inclusivo al final', () => {
    expect(eventosEntre(GUION_CRISIS, 20, 75).map((e) => e.id)).toEqual(['esc-gas-2']);
    expect(eventosEntre(GUION_CRISIS, 0, 20).map((e) => e.id)).toEqual(['esc-gas-1']);
  });

  it('un tramo vacío o invertido no devuelve nada', () => {
    expect(eventosEntre(GUION_CRISIS, 100, 100)).toEqual([]);
    expect(eventosEntre(GUION_CRISIS, 400, 10)).toEqual([]);
  });

  it('dos tramos contiguos no repiten ni pierden eventos', () => {
    const ids = [...eventosEntre(GUION_CRISIS, 0, 200), ...eventosEntre(GUION_CRISIS, 200, 500)].map((e) => e.id);
    expect(ids).toEqual(GUION_CRISIS.map((e) => e.id));
  });
});

describe.each(IDS_ESCENARIO)('escenario %s', (id) => {
  const { guion, zonas, retraso } = ESCENARIOS[id];

  it('tiene guion ordenado, sin ids repetidos y dentro de los 8 minutos, con tiempo para responder', () => {
    const tiempos = guion.map((e) => e.tSeg);
    expect(tiempos).toEqual([...tiempos].sort((a, b) => a - b));
    expect(tiempos.every((t) => t > 0 && t <= DURACION_ESCENARIO_SEG - 60)).toBe(true);
    expect(new Set(guion.map((e) => e.id)).size).toBe(guion.length);
    expect(guion.length).toBeGreaterThanOrEqual(5);
    expect(ESCENARIOS[id].id).toBe(id);
  });

  it('usa solo valores válidos del catálogo y ubicaciones en Pasto', () => {
    for (const { llamada } of guion) {
      expect(esTipoEmergencia(llamada.tipo)).toBe(true);
      expect(CANALES_LLAMADA).toContain(llamada.canal);
      expect(PRIORIDADES).toContain(llamada.prioridad);
      expect(llamada.narrativa.length).toBeGreaterThan(10);
      expect(llamada.ubicacion.lat).toBeGreaterThan(1.1);
      expect(llamada.ubicacion.lat).toBeLessThan(1.3);
      expect(llamada.ubicacion.lng).toBeGreaterThan(-77.4);
      expect(llamada.ubicacion.lng).toBeLessThan(-77.2);
    }
  });

  it('trae al menos un evento con llamadas duplicadas (mismo tipo, a menos de 50 m y en pocos minutos)', () => {
    const hayDuplicado = guion.some((a, i) =>
      guion.slice(i + 1).some(
        (b) => b.llamada.tipo === a.llamada.tipo && distanciaM(a.llamada.ubicacion, b.llamada.ubicacion) < 50 && b.tSeg - a.tSeg < 5 * 60,
      ),
    );
    expect(hayDuplicado).toBe(true);
  });

  it('parte con refugios válidos: ids únicos y ocupación dentro de la capacidad', () => {
    expect(new Set(zonas.map((z) => z.id)).size).toBe(zonas.length);
    expect(zonas.some((z) => z.tipo === 'Refugio')).toBe(true);
    for (const z of zonas) expect(z.capacidad_actual).toBeLessThanOrEqual(z.capacidad_maxima);
  });

  it(retraso ? 'retiene una unidad con un factor de velocidad menor que 1' : 'no retiene ninguna unidad', () => {
    if (retraso) {
      expect(retraso.factorVelocidad).toBeGreaterThan(0);
      expect(retraso.factorVelocidad).toBeLessThan(1);
      expect(retraso.tSeg).toBeLessThan(DURACION_ESCENARIO_SEG);
    } else {
      expect(retraso).toBeNull();
    }
  });
});

describe('ESCENARIOS', () => {
  it('son A, B y C; el A es el inicial y conserva la crisis de siempre', () => {
    expect(IDS_ESCENARIO).toEqual(['A', 'B', 'C']);
    expect(ESCENARIO_INICIAL).toBe('A');
    expect(ESCENARIOS.A.guion).toBe(GUION_CRISIS);
    expect(ESCENARIOS.A.retraso).toBe(TRAFICO_ESCENARIO);
  });

  it('el B es un deslizamiento con vía bloqueada, creciente cercana y refugios casi llenos', () => {
    const { guion, zonas } = ESCENARIOS.B;
    const tipos = new Set(guion.map((e) => e.llamada.tipo));
    for (const tipo of ['DESLIZAMIENTO', 'VIA_BLOQUEADA', 'CRECIENTE_SUBITA'] as const) expect(tipos.has(tipo)).toBe(true);
    const refugios = zonas.filter((z) => z.tipo === 'Refugio');
    expect(refugios.length).toBeGreaterThanOrEqual(2);
    expect(refugios.filter((z) => z.capacidad_actual / z.capacidad_maxima >= 0.8).length).toBeGreaterThanOrEqual(2);
    expect(zonas.some((z) => z.tipo === 'Bloqueo de Vía')).toBe(true);
  });

  it('el C junta 4 emergencias de distinto tipo, a pocas cuadras de las mismas bases', () => {
    const { guion } = ESCENARIOS.C;
    expect(new Set(guion.map((e) => e.llamada.tipo)).size).toBeGreaterThanOrEqual(4);
    expect(guion.filter((e) => e.llamada.prioridad === 'P1').length).toBeGreaterThanOrEqual(3);
    for (const a of guion) for (const b of guion) expect(distanciaM(a.llamada.ubicacion, b.llamada.ubicacion)).toBeLessThan(2000);
  });
});
