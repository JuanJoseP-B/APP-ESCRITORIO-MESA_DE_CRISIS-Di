// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { aplicarTema, temaGuardado } from './tema';

afterEach(() => {
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

describe('tema', () => {
  it('usa crema por defecto', () => {
    expect(temaGuardado()).toBe('crema');
  });

  it('aplica el tema en <html> y lo recuerda', () => {
    aplicarTema('carbon');
    expect(document.documentElement.dataset.theme).toBe('carbon');
    expect(temaGuardado()).toBe('carbon');
  });

  it('ignora valores guardados inválidos', () => {
    localStorage.setItem('argos.tema', 'neon');
    expect(temaGuardado()).toBe('crema');
  });
});
