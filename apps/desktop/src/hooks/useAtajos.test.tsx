// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAtajos } from './useAtajos';

afterEach(cleanup);

const acciones = () => ({
  '[': vi.fn(),
  ']': vi.fn(),
  j: vi.fn(),
  k: vi.fn(),
  F2: vi.fn(),
  Escape: vi.fn(),
  'Ctrl+Enter': vi.fn(),
});

describe('useAtajos', () => {
  it.each([
    ['[', '['],
    [']', ']'],
    ['J', 'j'],
    ['K', 'k'],
    ['F2', 'F2'],
    ['Escape', 'Escape'],
  ] as const)('la tecla %s dispara su acción', (key, nombre) => {
    const mapa = acciones();
    renderHook(() => useAtajos(mapa));
    fireEvent.keyDown(document.body, { key });
    expect(mapa[nombre]).toHaveBeenCalledTimes(1);
  });

  it('no dispara [, ], J, K ni F2 dentro de un <input>, pero Esc y Ctrl+Enter sí', () => {
    const mapa = acciones();
    renderHook(() => useAtajos(mapa));
    const { getByLabelText } = render(<input aria-label="narrativa" />);
    const campo = getByLabelText('narrativa');

    for (const key of ['[', ']', 'j', 'k', 'F2']) fireEvent.keyDown(campo, { key });
    expect(mapa['[']).not.toHaveBeenCalled();
    expect(mapa[']']).not.toHaveBeenCalled();
    expect(mapa.j).not.toHaveBeenCalled();
    expect(mapa.k).not.toHaveBeenCalled();
    expect(mapa.F2).not.toHaveBeenCalled();

    fireEvent.keyDown(campo, { key: 'Escape' });
    fireEvent.keyDown(campo, { key: 'Enter', ctrlKey: true });
    expect(mapa.Escape).toHaveBeenCalledTimes(1);
    expect(mapa['Ctrl+Enter']).toHaveBeenCalledTimes(1);
  });

  it('tampoco dispara dentro de un <textarea>', () => {
    const mapa = acciones();
    renderHook(() => useAtajos(mapa));
    const { getByLabelText } = render(<textarea aria-label="narrativa" />);
    fireEvent.keyDown(getByLabelText('narrativa'), { key: 'j' });
    expect(mapa.j).not.toHaveBeenCalled();
  });

  it('impide la acción por defecto de la tecla atendida y no la de las demás', () => {
    renderHook(() => useAtajos(acciones()));
    expect(fireEvent.keyDown(document.body, { key: 'F2' })).toBe(false);
    expect(fireEvent.keyDown(document.body, { key: 'x' })).toBe(true);
  });

  it('usa siempre el mapa más reciente sin volver a registrar el listener', () => {
    const primera = vi.fn();
    const segunda = vi.fn();
    const { rerender } = renderHook(({ accion }) => useAtajos({ j: accion }), { initialProps: { accion: primera } });
    rerender({ accion: segunda });
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(primera).not.toHaveBeenCalled();
    expect(segunda).toHaveBeenCalledTimes(1);
  });

  it('con activo=false no escucha, y deja de escuchar al desmontar', () => {
    const mapa = acciones();
    const inactivo = renderHook(() => useAtajos(mapa, false));
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(mapa.j).not.toHaveBeenCalled();
    inactivo.unmount();

    const activo = renderHook(() => useAtajos(mapa));
    activo.unmount();
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(mapa.j).not.toHaveBeenCalled();
  });
});
