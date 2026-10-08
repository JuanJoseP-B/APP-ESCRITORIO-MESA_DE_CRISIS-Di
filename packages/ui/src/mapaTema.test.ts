// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { leerToken, observarTema, opacidadZona } from './mapaTema';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset.theme;
});

describe('mapaTema', () => {
  it('lee un token del tema activo sin espacios', () => {
    document.documentElement.style.setProperty('--status-critical', ' #a3221b ');
    expect(leerToken('status-critical')).toBe('#a3221b');
    expect(leerToken('no-existe')).toBe('');
  });

  it('opacidadZona usa el token o un respaldo', () => {
    expect(opacidadZona()).toBe(0.2);
    document.documentElement.style.setProperty('--opacity-zone-fill', '0.35');
    expect(opacidadZona()).toBe(0.35);
  });

  it('avisa al cambiar data-theme y deja de avisar al desuscribirse', async () => {
    const alCambiar = vi.fn();
    const detener = observarTema(alCambiar);
    document.documentElement.dataset.theme = 'carbon';
    await vi.waitFor(() => expect(alCambiar).toHaveBeenCalledTimes(1));
    detener();
    document.documentElement.dataset.theme = 'crema';
    await new Promise((r) => setTimeout(r, 20));
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });
});
