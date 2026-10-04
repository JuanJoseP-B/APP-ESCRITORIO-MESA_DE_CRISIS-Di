import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ESTADOS_RECURSO,
  TRANSICIONES_RECURSO,
  puedeTransicionar,
  transicionarRecurso,
  type Recurso,
} from './recurso';

const base: Recurso = { id: 'r1', tipo: 'Bomberos', estado_actual: 'Disponible', incidente_asignado_id: null };

describe('máquina de estados de recursos', () => {
  it('define transiciones para todos los estados y solo hacia estados válidos', () => {
    for (const estado of ESTADOS_RECURSO) {
      expect(TRANSICIONES_RECURSO[estado]).toBeDefined();
      for (const destino of TRANSICIONES_RECURSO[estado]) {
        expect(ESTADOS_RECURSO).toContain(destino);
        expect(destino).not.toBe(estado);
      }
    }
  });

  it('permite y rechaza transiciones', () => {
    expect(puedeTransicionar('Disponible', 'Despachado')).toBe(true);
    expect(puedeTransicionar('Despachado', 'En Escena')).toBe(true);
    expect(puedeTransicionar('Disponible', 'En Escena')).toBe(false);
    expect(puedeTransicionar('Inoperativo', 'Despachado')).toBe(false);
  });

  it('despachar exige incidente y lo asigna', () => {
    expect(() => transicionarRecurso(base, 'Despachado')).toThrow('incidente');
    const r = transicionarRecurso(base, 'Despachado', 'inc-1');
    expect(r).toMatchObject({ estado_actual: 'Despachado', incidente_asignado_id: 'inc-1' });
    expect(base.estado_actual).toBe('Disponible');
  });

  it('En Escena conserva el incidente; Disponible e Inoperativo lo liberan', () => {
    const despachado = transicionarRecurso(base, 'Despachado', 'inc-1');
    const enEscena = transicionarRecurso(despachado, 'En Escena');
    expect(enEscena.incidente_asignado_id).toBe('inc-1');
    expect(transicionarRecurso(enEscena, 'Disponible').incidente_asignado_id).toBeNull();
    expect(transicionarRecurso(enEscena, 'Inoperativo').incidente_asignado_id).toBeNull();
  });

  it('lanza ante una transición inválida', () => {
    expect(() => transicionarRecurso(base, 'En Escena')).toThrow('Disponible');
  });

  it('Recurso no expone coordenadas', () => {
    expectTypeOf<Recurso>().not.toHaveProperty('lat');
    expectTypeOf<Recurso>().not.toHaveProperty('lng');
  });
});
