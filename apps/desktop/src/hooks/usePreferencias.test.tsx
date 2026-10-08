// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { PreferenciasProvider, usePreferencias } from './usePreferencias';

type Oyente = (e: MediaQueryListEvent) => void;

/** `matchMedia` falso: permite cambiar el esquema de color del sistema durante la prueba. */
function simularSistema(oscuroInicial: boolean) {
  let oscuro = oscuroInicial;
  const oyentes = new Set<Oyente>();
  vi.stubGlobal('matchMedia', (consulta: string) => ({
    media: consulta,
    get matches() {
      return oscuro;
    },
    addEventListener: (_: string, fn: Oyente) => oyentes.add(fn),
    removeEventListener: (_: string, fn: Oyente) => oyentes.delete(fn),
  }));
  return (valor: boolean) => {
    oscuro = valor;
    oyentes.forEach((fn) => fn({ matches: valor } as MediaQueryListEvent));
  };
}

function Sonda() {
  const { preferencias, temaEfectivo, fijar } = usePreferencias();
  return (
    <div>
      <p data-testid="efectivo">{temaEfectivo}</p>
      <p data-testid="idioma">{preferencias.idioma}</p>
      <button onClick={() => fijar({ tema: 'sistema' })}>sistema</button>
      <button onClick={() => fijar({ tema: 'carbon' })}>carbon</button>
      <button onClick={() => fijar({ idioma: 'en', textoGrande: true, reducirMovimiento: true })}>todo</button>
    </div>
  );
}

const montar = () =>
  render(
    <IdiomaProvider>
      <PreferenciasProvider>
        <Sonda />
      </PreferenciasProvider>
    </IdiomaProvider>,
  );

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  const { dataset } = document.documentElement;
  delete dataset['theme'];
  delete dataset['reducedMotion'];
  delete dataset['textLarge'];
});

describe('PreferenciasProvider', () => {
  it('arranca con crema y lo aplica a <html>', () => {
    montar();
    expect(screen.getByTestId('efectivo').textContent).toBe('crema');
    expect(document.documentElement.dataset['theme']).toBe('crema');
  });

  it('con «sistema» sigue prefers-color-scheme y reacciona a sus cambios', () => {
    const cambiarSistema = simularSistema(true);
    montar();
    act(() => screen.getByRole('button', { name: 'sistema' }).click());
    expect(screen.getByTestId('efectivo').textContent).toBe('carbon');
    expect(document.documentElement.dataset['theme']).toBe('carbon');
    act(() => cambiarSistema(false));
    expect(screen.getByTestId('efectivo').textContent).toBe('crema');
    expect(document.documentElement.dataset['theme']).toBe('crema');
  });

  it('un tema fijo ignora los cambios del sistema', () => {
    const cambiarSistema = simularSistema(false);
    montar();
    act(() => screen.getByRole('button', { name: 'carbon' }).click());
    act(() => cambiarSistema(true));
    act(() => cambiarSistema(false));
    expect(screen.getByTestId('efectivo').textContent).toBe('carbon');
  });

  it('fijar aplica y persiste idioma, movimiento y texto', () => {
    montar();
    act(() => screen.getByRole('button', { name: 'todo' }).click());
    expect(screen.getByTestId('idioma').textContent).toBe('en');
    expect(document.documentElement.lang).toBe('en');
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(document.documentElement.getAttribute('data-text-large')).toBe('true');
    expect(localStorage.getItem('argos.idioma')).toBe('en');
    expect(localStorage.getItem('argos.textoGrande')).toBe('true');
    expect(localStorage.getItem('argos.reducirMovimiento')).toBe('true');
  });

  it('lee lo guardado al montar', () => {
    localStorage.setItem('argos.tema', 'carbon');
    localStorage.setItem('argos.textoGrande', 'true');
    montar();
    expect(screen.getByTestId('efectivo').textContent).toBe('carbon');
    expect(document.documentElement.getAttribute('data-text-large')).toBe('true');
  });
});
