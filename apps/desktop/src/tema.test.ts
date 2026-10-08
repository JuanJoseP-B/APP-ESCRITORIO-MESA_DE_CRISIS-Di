// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { aplicarTema, guardarTemaPreferido, resolverTema, temaPreferidoGuardado } from './tema';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('tema', () => {
  it('usa crema por defecto', () => {
    expect(temaPreferidoGuardado()).toBe('crema');
  });

  it('aplica el tema en <html>', () => {
    aplicarTema('carbon');
    expect(document.documentElement.dataset.theme).toBe('carbon');
  });

  it('recuerda la preferencia, incluido «sistema»', () => {
    guardarTemaPreferido('sistema');
    expect(temaPreferidoGuardado()).toBe('sistema');
    guardarTemaPreferido('carbon');
    expect(temaPreferidoGuardado()).toBe('carbon');
  });

  it('ignora valores guardados inválidos', () => {
    localStorage.setItem('argos.tema', 'neon');
    expect(temaPreferidoGuardado()).toBe('crema');
  });

  it('«sistema» sigue a prefers-color-scheme y los temas fijos lo ignoran', () => {
    expect(resolverTema('sistema', true)).toBe('carbon');
    expect(resolverTema('sistema', false)).toBe('crema');
    expect(resolverTema('crema', true)).toBe('crema');
    expect(resolverTema('carbon', false)).toBe('carbon');
  });
});
