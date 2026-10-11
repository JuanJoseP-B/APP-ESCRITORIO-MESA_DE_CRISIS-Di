// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { NOMBRES_DURACION, duracion, duracionSegundos, milisegundos, movimientoReducido } from './movimiento';
import css from './tokens.css?raw';

afterEach(() => {
  document.documentElement.removeAttribute('style');
  delete document.documentElement.dataset['reducedMotion'];
});

/** Cuerpo del primer bloque cuyo selector contiene `selector`. */
const bloque = (selector: string): string => {
  const i = css.indexOf(selector);
  expect(i).toBeGreaterThanOrEqual(0);
  return css.slice(css.indexOf('{', i) + 1, css.indexOf('}', i));
};

describe('tokens de movimiento', () => {
  it('definen las cuatro duraciones y las dos curvas', () => {
    for (const [nombre, ms] of [['instant', 80], ['fast', 150], ['base', 240], ['slow', 400]] as const) {
      expect(css).toContain(`--dur-${nombre}: ${ms}ms;`);
    }
    expect(css).toMatch(/--ease-mecanico:\s*cubic-bezier\(0\.2, 0, 0, 1\);/);
    expect(css).toMatch(/--ease-salida:\s*cubic-bezier\(0, 0, 0\.2, 1\);/);
  });

  it('con prefers-reduced-motion y con data-reduced-motion las cuatro duraciones valen 0ms', () => {
    for (const selector of ['@media (prefers-reduced-motion: reduce)', ":root[data-reduced-motion='true']"]) {
      const cuerpo = selector.startsWith('@media') ? css.slice(css.indexOf(selector)) : bloque(selector);
      for (const nombre of NOMBRES_DURACION) expect(cuerpo).toContain(`--dur-${nombre}: 0ms;`);
    }
  });
});

describe('duracion()', () => {
  it('lee el token en milisegundos y en segundos', () => {
    document.documentElement.style.setProperty('--dur-base', ' 240ms ');
    expect(duracion('base')).toBe(240);
    expect(duracionSegundos('base')).toBe(0.24);
  });

  it('acepta segundos y devuelve 0 cuando el token vale 0ms (movimiento reducido)', () => {
    document.documentElement.style.setProperty('--dur-fast', '0.15s');
    expect(duracion('fast')).toBe(150);
    document.documentElement.style.setProperty('--dur-fast', '0ms');
    expect(duracion('fast')).toBe(0);
  });

  it('usa el valor de tokens.css si el token no está definido', () => {
    expect(duracion('slow')).toBe(400);
    expect(duracion('instant')).toBe(80);
  });

  it('milisegundos() rechaza lo que no es una duración', () => {
    expect(milisegundos('rápido')).toBeNull();
    expect(milisegundos('12px')).toBeNull();
  });
});

describe('movimientoReducido()', () => {
  it('sigue el ajuste data-reduced-motion', () => {
    expect(movimientoReducido()).toBe(false);
    document.documentElement.dataset['reducedMotion'] = 'true';
    expect(movimientoReducido()).toBe(true);
  });
});
