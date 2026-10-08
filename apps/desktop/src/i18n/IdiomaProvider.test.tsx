// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it } from 'vitest';
import { en } from './en';
import { es, type ClaveTexto, type Diccionario } from './es';
import { IdiomaProvider, useTexto } from './IdiomaProvider';
import { CLAVE_IDIOMA, idiomaGuardado, traducir } from './idioma';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.lang = '';
});
afterEach(cleanup);

function Muestra() {
  const { t, idioma, fijarIdioma } = useTexto();
  return (
    <div>
      <p data-testid="texto">{t('idioma.es')}</p>
      <p data-testid="actual">{idioma}</p>
      <button onClick={() => fijarIdioma(idioma === 'es' ? 'en' : 'es')}>cambiar</button>
    </div>
  );
}

describe('diccionarios', () => {
  it('en.ts tiene exactamente las mismas claves que es.ts', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(es).sort());
  });

  it('una clave faltante o sobrante en un diccionario rompe el typecheck', () => {
    expectTypeOf<Diccionario>().toEqualTypeOf<Record<ClaveTexto, string>>();
    // @ts-expect-error falta la clave 'idioma.en'
    const incompleto: Diccionario = { 'idioma.es': 'Spanish' };
    // @ts-expect-error la clave 'sobra' no existe en es.ts
    const sobrante: Diccionario = { ...en, sobra: 'x' };
    expect([incompleto, sobrante]).toHaveLength(2);
  });
});

describe('traducir', () => {
  const dic = { 'idioma.es': 'Hola {nombre}, tienes {n} avisos', 'idioma.en': '{nombre}' } satisfies Diccionario;

  it('sustituye los parámetros y deja a la vista el que falta', () => {
    expect(traducir(dic, 'idioma.es', { nombre: 'Ana', n: 3 })).toBe('Hola Ana, tienes 3 avisos');
    expect(traducir(dic, 'idioma.es', { nombre: 'Ana' })).toBe('Hola Ana, tienes {n} avisos');
    expect(traducir(dic, 'idioma.es')).toBe('Hola {nombre}, tienes {n} avisos');
  });
});

describe('IdiomaProvider', () => {
  it('sin proveedor muestra español', () => {
    render(<Muestra />);
    expect(screen.getByTestId('actual').textContent).toBe('es');
  });

  it('cambiar de idioma vuelve a renderizar, persiste y fija lang en <html>', async () => {
    render(
      <IdiomaProvider>
        <Muestra />
      </IdiomaProvider>,
    );
    expect(screen.getByTestId('actual').textContent).toBe('es');
    expect(document.documentElement.lang).toBe('es');
    await userEvent.click(screen.getByRole('button', { name: 'cambiar' }));
    expect(screen.getByTestId('actual').textContent).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(localStorage.getItem(CLAVE_IDIOMA)).toBe('en');
  });

  it('arranca con el idioma guardado', () => {
    localStorage.setItem(CLAVE_IDIOMA, 'en');
    render(
      <IdiomaProvider>
        <Muestra />
      </IdiomaProvider>,
    );
    expect(screen.getByTestId('actual').textContent).toBe('en');
  });

  it('un valor guardado inválido o un almacenamiento roto cae en español', () => {
    localStorage.setItem(CLAVE_IDIOMA, 'fr');
    expect(idiomaGuardado()).toBe('es');
    const original = Storage.prototype.getItem;
    Storage.prototype.getItem = () => {
      throw new Error('bloqueado');
    };
    try {
      expect(idiomaGuardado()).toBe('es');
    } finally {
      Storage.prototype.getItem = original;
    }
  });
});
