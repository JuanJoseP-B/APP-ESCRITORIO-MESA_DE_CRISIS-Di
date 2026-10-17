// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hayCapaEscape, useCapaEscape } from './useCapaEscape';

afterEach(cleanup);

function Capa({ onCerrar }: { readonly onCerrar: () => void }) {
  useCapaEscape(onCerrar);
  return null;
}

describe('useCapaEscape', () => {
  it('Esc cierra la capa y no llega a los listeners registrados después', async () => {
    const cerrar = vi.fn();
    render(<Capa onCerrar={cerrar} />);
    const global = vi.fn();
    document.addEventListener('keydown', global);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', global);
    expect(cerrar).toHaveBeenCalledTimes(1);
    expect(global).not.toHaveBeenCalled();
  });

  it('con varias capas, Esc cierra solo la de arriba (la última montada)', async () => {
    const abajo = vi.fn();
    const arriba = vi.fn();
    render(<Capa onCerrar={abajo} />);
    const { unmount } = render(<Capa onCerrar={arriba} />);
    await userEvent.keyboard('{Escape}');
    expect(arriba).toHaveBeenCalledTimes(1);
    expect(abajo).not.toHaveBeenCalled();
    unmount();
    await userEvent.keyboard('{Escape}');
    expect(abajo).toHaveBeenCalledTimes(1);
  });

  it('otras teclas no la cierran y hayCapaEscape refleja si hay alguna abierta', async () => {
    const cerrar = vi.fn();
    expect(hayCapaEscape()).toBe(false);
    const { unmount } = render(<Capa onCerrar={cerrar} />);
    expect(hayCapaEscape()).toBe(true);
    await userEvent.keyboard('a');
    expect(cerrar).not.toHaveBeenCalled();
    unmount();
    expect(hayCapaEscape()).toBe(false);
  });
});
