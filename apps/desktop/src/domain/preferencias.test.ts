// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  PREFERENCIAS_POR_DEFECTO,
  aplicarPreferencias,
  guardarPreferencias,
  leerPreferencias,
  type Preferencias,
} from './preferencias';

const TODAS: Preferencias = { tema: 'sistema', idioma: 'en', reducirMovimiento: true, textoGrande: true };

afterEach(() => {
  localStorage.clear();
  const { dataset } = document.documentElement;
  delete dataset['theme'];
  delete dataset['reducedMotion'];
  delete dataset['textLarge'];
});

describe('leer y guardar', () => {
  it('sin nada guardado devuelve los valores por defecto', () => {
    expect(leerPreferencias()).toEqual(PREFERENCIAS_POR_DEFECTO);
    expect(PREFERENCIAS_POR_DEFECTO).toEqual({ tema: 'crema', idioma: 'es', reducirMovimiento: false, textoGrande: false });
  });

  it('lo guardado se lee igual', () => {
    guardarPreferencias(TODAS);
    expect(leerPreferencias()).toEqual(TODAS);
  });

  it('un valor inválido cae en el valor por defecto sin afectar a los demás', () => {
    guardarPreferencias(TODAS);
    localStorage.setItem('argos.tema', 'neon');
    localStorage.setItem('argos.idioma', 'fr');
    localStorage.setItem('argos.reducirMovimiento', 'quizá');
    expect(leerPreferencias()).toEqual({ ...PREFERENCIAS_POR_DEFECTO, textoGrande: true });
  });

  it('un almacenamiento que falla no lanza y devuelve los valores por defecto', () => {
    const { getItem, setItem } = Storage.prototype;
    Storage.prototype.getItem = () => {
      throw new Error('bloqueado');
    };
    Storage.prototype.setItem = () => {
      throw new Error('bloqueado');
    };
    try {
      expect(leerPreferencias()).toEqual(PREFERENCIAS_POR_DEFECTO);
      expect(() => guardarPreferencias(TODAS)).not.toThrow();
    } finally {
      Storage.prototype.getItem = getItem;
      Storage.prototype.setItem = setItem;
    }
  });
});

describe('aplicarPreferencias', () => {
  const { dataset } = document.documentElement;

  it('pinta el tema fijo, sin movimiento reducido ni texto grande', () => {
    aplicarPreferencias(PREFERENCIAS_POR_DEFECTO, true);
    expect(dataset['theme']).toBe('crema');
    expect(dataset['reducedMotion']).toBeUndefined();
    expect(dataset['textLarge']).toBeUndefined();
  });

  it('«sistema» pinta carbón si el sistema es oscuro y crema si no', () => {
    aplicarPreferencias({ ...PREFERENCIAS_POR_DEFECTO, tema: 'sistema' }, true);
    expect(dataset['theme']).toBe('carbon');
    aplicarPreferencias({ ...PREFERENCIAS_POR_DEFECTO, tema: 'sistema' }, false);
    expect(dataset['theme']).toBe('crema');
  });

  it('data-reduced-motion y data-text-large aparecen y se retiran', () => {
    aplicarPreferencias(TODAS, false);
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(document.documentElement.getAttribute('data-text-large')).toBe('true');
    aplicarPreferencias(PREFERENCIAS_POR_DEFECTO, false);
    expect(document.documentElement.hasAttribute('data-reduced-motion')).toBe(false);
    expect(document.documentElement.hasAttribute('data-text-large')).toBe(false);
  });
});
