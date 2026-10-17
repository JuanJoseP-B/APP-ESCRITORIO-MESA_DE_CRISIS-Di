import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ESTADOS_RECURSO,
  ORIGENES_EVENTO_RECURSO,
  PRIORIDADES,
  SLA_POR_PRIORIDAD,
  type EstadoRecurso,
  type EstadoSla,
  type EventoRecurso,
} from './index';

describe('SLA_POR_PRIORIDAD', () => {
  it('fija los umbrales del roadmap §3.3', () => {
    expect(SLA_POR_PRIORIDAD).toEqual({
      P1: { aEnRutaSeg: 120, aEnEscenaSeg: 600, alertaPrevia: 0.8 },
      P2: { aEnRutaSeg: 180, aEnEscenaSeg: 900, alertaPrevia: 0.8 },
      P3: { aEnRutaSeg: 300, aEnEscenaSeg: 1500, alertaPrevia: 0.8 },
      P4: { aEnRutaSeg: 600, aEnEscenaSeg: 2700, alertaPrevia: 0.8 },
    });
  });

  it('cada prioridad es más holgada que la anterior y llegar a escena lleva más que salir', () => {
    for (const [i, p] of PRIORIDADES.entries()) {
      const u = SLA_POR_PRIORIDAD[p];
      expect(u.aEnEscenaSeg).toBeGreaterThan(u.aEnRutaSeg);
      expect(u.alertaPrevia).toBeGreaterThan(0);
      expect(u.alertaPrevia).toBeLessThan(1);
      const anterior = PRIORIDADES[i - 1];
      if (anterior) expect(u.aEnRutaSeg).toBeGreaterThan(SLA_POR_PRIORIDAD[anterior].aEnRutaSeg);
    }
  });
});

describe('contratos de eventos y estado de SLA', () => {
  it('los eventos usan los estados de recurso de recurso.ts, sin una segunda lista', () => {
    expectTypeOf<EventoRecurso['desde']>().toEqualTypeOf<EstadoRecurso>();
    expectTypeOf<EventoRecurso['hacia']>().toEqualTypeOf<EstadoRecurso>();
    expect(ESTADOS_RECURSO).toHaveLength(5);
    expect(ORIGENES_EVENTO_RECURSO).toEqual(['MANUAL', 'IA', 'SISTEMA']);
  });

  it('EstadoSla distingue el hito esperado del nivel', () => {
    const sla: EstadoSla = { recursoId: 'r1', hito: 'EN_RUTA', transcurridoSeg: 90, limiteSeg: 120, nivel: 'EN_TIEMPO' };
    expect(sla.limiteSeg).toBe(120);
    expectTypeOf<EstadoSla['nivel']>().toEqualTypeOf<'EN_TIEMPO' | 'ALERTA' | 'VENCIDO' | 'NO_APLICA'>();
  });
});
