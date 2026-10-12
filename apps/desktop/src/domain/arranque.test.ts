import { describe, expect, it } from 'vitest';
import {
  DURACION_ARRANQUE_MS,
  LINEAS_ARRANQUE,
  TICS_ARRANQUE,
  TIC_ARRANQUE_MS,
  faseLinea,
  lineasArranque,
  type SubsistemasArranque,
} from './arranque';

const TODO_BIEN: SubsistemasArranque = {
  enlace: 'EN_VIVO',
  unidades: { cargando: false, error: null, disponibles: 4, total: 6 },
  refugios: { cargando: false, error: null, activos: 3 },
  mapa: 'LISTO',
};

const resultados = (s: SubsistemasArranque) => Object.fromEntries(lineasArranque(s).map((l) => [l.id, l.resultado]));

describe('lineasArranque', () => {
  it('una línea por subsistema, en orden, con los conteos reales', () => {
    const lineas = lineasArranque(TODO_BIEN);
    expect(lineas.map((l) => l.id)).toEqual([...LINEAS_ARRANQUE]);
    expect(lineas.every((l) => l.resultado === 'OK')).toBe(true);
    expect(lineas[2]).toMatchObject({ detalle: 'arranque.unidades.conteo', params: { disponibles: 4, total: 6 } });
    expect(lineas[3]).toMatchObject({ detalle: 'arranque.refugios.conteo', params: { activos: 3 } });
  });

  it('lo que sigue cargando queda pendiente, no como éxito', () => {
    expect(
      resultados({
        enlace: 'CONECTANDO',
        unidades: { cargando: true, error: null, disponibles: 0, total: 0 },
        refugios: { cargando: true, error: null, activos: 0 },
        mapa: 'CARGANDO',
      }),
    ).toEqual({ argos: 'OK', enlace: 'PENDIENTE', unidades: 'PENDIENTE', refugios: 'PENDIENTE', mapa: 'PENDIENTE' });
  });

  it('cada fallo se dice en su línea y no arrastra a las demás', () => {
    const lineas = lineasArranque({ ...TODO_BIEN, enlace: 'SIN_ENLACE', unidades: { cargando: false, error: 'red caída', disponibles: 0, total: 0 }, mapa: 'ERROR' });
    expect(Object.fromEntries(lineas.map((l) => [l.id, l.resultado]))).toEqual({ argos: 'OK', enlace: 'ERROR', unidades: 'ERROR', refugios: 'OK', mapa: 'ERROR' });
    expect(lineas.map((l) => l.detalle)).toEqual(['arranque.argos.ok', 'enlace.SIN_ENLACE', 'arranque.unidades.error', 'arranque.refugios.conteo', 'arranque.mapa.error']);
  });

  it('un error prevalece aunque la lista siga marcada como cargando', () => {
    expect(resultados({ ...TODO_BIEN, refugios: { cargando: true, error: 'x', activos: 0 } })['refugios']).toBe('ERROR');
  });
});

describe('ritmo de la secuencia', () => {
  it('cada línea aparece comprobando y se resuelve en el tic siguiente', () => {
    expect(faseLinea(0, 0)).toBe('comprobando');
    expect(faseLinea(0, 1)).toBe('resuelta');
    expect(faseLinea(2, 3)).toBe('oculta');
    expect(faseLinea(2, 4)).toBe('comprobando');
    expect(faseLinea(4, TICS_ARRANQUE)).toBe('resuelta');
  });

  it('todas las líneas se resuelven antes de que termine la secuencia', () => {
    expect((TICS_ARRANQUE - 1) * TIC_ARRANQUE_MS).toBeLessThan(DURACION_ARRANQUE_MS);
  });
});
