import { describe, expect, it } from 'vitest';
import { CANALES_LLAMADA, PRIORIDADES, esTipoEmergencia } from '@argos/shared';
import { distanciaM } from './geo';
import { DURACION_ESCENARIO_SEG, GUION_CRISIS, eventosEntre, eventosHasta, type Guion } from './escenario';

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
