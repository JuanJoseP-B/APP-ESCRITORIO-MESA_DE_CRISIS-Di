import { describe, expect, it } from 'vitest';
import { aplicarCambio } from './realtime';

interface Fila {
  readonly id: string;
  readonly v: number;
}
const lista: readonly Fila[] = [
  { id: '1', v: 1 },
  { id: '2', v: 2 },
];

describe('aplicarCambio', () => {
  it('INSERT agrega una fila nueva', () => {
    const r = aplicarCambio(lista, { tipo: 'INSERT', nuevo: { id: '3', v: 3 }, idEliminado: null });
    expect(r.map((x) => x.id)).toEqual(['1', '2', '3']);
  });

  it('INSERT con id existente no duplica (reemplaza)', () => {
    const r = aplicarCambio(lista, { tipo: 'INSERT', nuevo: { id: '1', v: 9 }, idEliminado: null });
    expect(r).toHaveLength(2);
    expect(r[0]?.v).toBe(9);
  });

  it('UPDATE reemplaza por id y no agrega si no existe', () => {
    expect(
      aplicarCambio(lista, { tipo: 'UPDATE', nuevo: { id: '2', v: 7 }, idEliminado: null })[1]?.v,
    ).toBe(7);
    expect(
      aplicarCambio(lista, { tipo: 'UPDATE', nuevo: { id: '9', v: 7 }, idEliminado: null }),
    ).toHaveLength(2);
  });

  it('DELETE elimina por id', () => {
    const r = aplicarCambio(lista, { tipo: 'DELETE', nuevo: null, idEliminado: '1' });
    expect(r.map((x) => x.id)).toEqual(['2']);
  });

  it('no muta la lista original', () => {
    aplicarCambio(lista, { tipo: 'DELETE', nuevo: null, idEliminado: '1' });
    expect(lista).toHaveLength(2);
  });
});
