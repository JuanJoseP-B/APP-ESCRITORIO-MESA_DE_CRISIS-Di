import { describe, expect, expectTypeOf, it } from 'vitest';
import {
  ESTADOS_RECURSO,
  TRANSICIONES_RECURSO,
  puedeTransicionar,
  transicionarRecurso,
  type Recurso,
} from './recurso';
import type { Coordenadas } from './geo';

const base: Recurso = { id: 'r1', tipo: 'Bomberos', estado_actual: 'DISPONIBLE', incidente_asignado_id: null };

describe('máquina de estados de recursos', () => {
  it('el ciclo de vida CAD tiene cinco estados', () => {
    expect(ESTADOS_RECURSO).toEqual(['DISPONIBLE', 'ASIGNADO', 'EN_RUTA', 'EN_ESCENA', 'INOPERATIVO']);
  });

  it('define transiciones para todos los estados y solo hacia estados válidos', () => {
    for (const estado of ESTADOS_RECURSO) {
      expect(TRANSICIONES_RECURSO[estado]).toBeDefined();
      for (const destino of TRANSICIONES_RECURSO[estado]) {
        expect(ESTADOS_RECURSO).toContain(destino);
        expect(destino).not.toBe(estado);
      }
    }
  });

  it('acepta el ciclo completo DISPONIBLE → ASIGNADO → EN_RUTA → EN_ESCENA → DISPONIBLE', () => {
    expect(puedeTransicionar('DISPONIBLE', 'ASIGNADO')).toBe(true);
    expect(puedeTransicionar('ASIGNADO', 'EN_RUTA')).toBe(true);
    expect(puedeTransicionar('EN_RUTA', 'EN_ESCENA')).toBe(true);
    expect(puedeTransicionar('EN_ESCENA', 'DISPONIBLE')).toBe(true);
  });

  it('rechaza los saltos: DISPONIBLE → EN_ESCENA, DISPONIBLE → EN_RUTA y ASIGNADO → EN_ESCENA', () => {
    expect(puedeTransicionar('DISPONIBLE', 'EN_ESCENA')).toBe(false);
    expect(puedeTransicionar('DISPONIBLE', 'EN_RUTA')).toBe(false);
    expect(puedeTransicionar('ASIGNADO', 'EN_ESCENA')).toBe(false);
    expect(puedeTransicionar('INOPERATIVO', 'ASIGNADO')).toBe(false);
  });

  it('cancelar un despacho (ASIGNADO o EN_RUTA → DISPONIBLE) es válido', () => {
    expect(puedeTransicionar('ASIGNADO', 'DISPONIBLE')).toBe(true);
    expect(puedeTransicionar('EN_RUTA', 'DISPONIBLE')).toBe(true);
  });

  it('INOPERATIVO se alcanza desde cualquier estado operativo y solo vuelve a DISPONIBLE', () => {
    for (const estado of ESTADOS_RECURSO.filter((e) => e !== 'INOPERATIVO')) {
      expect(puedeTransicionar(estado, 'INOPERATIVO')).toBe(true);
    }
    expect(TRANSICIONES_RECURSO.INOPERATIVO).toEqual(['DISPONIBLE']);
  });

  it('asignar exige incidente y lo asigna', () => {
    expect(() => transicionarRecurso(base, 'ASIGNADO')).toThrow('incidente');
    const r = transicionarRecurso(base, 'ASIGNADO', 'inc-1');
    expect(r).toMatchObject({ estado_actual: 'ASIGNADO', incidente_asignado_id: 'inc-1' });
    expect(base.estado_actual).toBe('DISPONIBLE');
  });

  it('EN_RUTA y EN_ESCENA conservan el incidente; DISPONIBLE e INOPERATIVO lo liberan', () => {
    const asignado = transicionarRecurso(base, 'ASIGNADO', 'inc-1');
    const enRuta = transicionarRecurso(asignado, 'EN_RUTA');
    expect(enRuta.incidente_asignado_id).toBe('inc-1');
    const enEscena = transicionarRecurso(enRuta, 'EN_ESCENA');
    expect(enEscena.incidente_asignado_id).toBe('inc-1');
    expect(transicionarRecurso(enEscena, 'DISPONIBLE').incidente_asignado_id).toBeNull();
    expect(transicionarRecurso(enEscena, 'INOPERATIVO').incidente_asignado_id).toBeNull();
    expect(transicionarRecurso(enRuta, 'DISPONIBLE').incidente_asignado_id).toBeNull();
  });

  it('lanza ante una transición inválida', () => {
    expect(() => transicionarRecurso(base, 'EN_ESCENA')).toThrow('DISPONIBLE');
  });

  it('Recurso no expone lat ni lng: la posición va en `ubicacion`', () => {
    expectTypeOf<Recurso>().not.toHaveProperty('lat');
    expectTypeOf<Recurso>().not.toHaveProperty('lng');
    expectTypeOf<Recurso['ubicacion']>().toEqualTypeOf<Coordenadas | null | undefined>();
  });

  describe('posición', () => {
    const base_: Coordenadas = { lat: 1.2136, lng: -77.2811 };
    const escena: Coordenadas = { lat: 1.2201, lng: -77.2765 };
    const unidad: Recurso = { ...base, base: base_, ubicacion: base_ };

    it('al llegar a la escena copia la ubicación del incidente', () => {
      const enRuta = transicionarRecurso(transicionarRecurso(unidad, 'ASIGNADO', 'inc-1'), 'EN_RUTA');
      expect(enRuta.ubicacion).toEqual(base_);
      expect(transicionarRecurso(enRuta, 'EN_ESCENA', undefined, escena).ubicacion).toEqual(escena);
    });

    it('sin ubicación del incidente conserva la actual', () => {
      const enRuta = transicionarRecurso(transicionarRecurso(unidad, 'ASIGNADO', 'inc-1'), 'EN_RUTA');
      expect(transicionarRecurso(enRuta, 'EN_ESCENA').ubicacion).toEqual(base_);
    });

    it('al quedar disponible regresa a su base, también si se cancela el despacho', () => {
      const enEscena: Recurso = { ...unidad, estado_actual: 'EN_ESCENA', incidente_asignado_id: 'inc-1', ubicacion: escena };
      expect(transicionarRecurso(enEscena, 'DISPONIBLE').ubicacion).toEqual(base_);
      const asignado = transicionarRecurso(unidad, 'ASIGNADO', 'inc-1');
      expect(transicionarRecurso(asignado, 'DISPONIBLE').ubicacion).toEqual(base_);
    });

    it('sin base conocida, DISPONIBLE no inventa una posición', () => {
      const sinBase: Recurso = { ...base, estado_actual: 'EN_ESCENA', incidente_asignado_id: 'inc-1', ubicacion: escena };
      expect(transicionarRecurso(sinBase, 'DISPONIBLE').ubicacion).toEqual(escena);
    });
  });
});
