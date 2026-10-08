import { describe, expect, it, vi } from 'vitest';
import { GRUPOS_ATAJOS, esCampoDeEntrada, nombreDeTecla, resolverAtajo, type TeclaPulsada } from './atajos';

const tecla = (key: string, extra: Partial<TeclaPulsada> = {}): TeclaPulsada => ({
  key,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...extra,
});

describe('nombreDeTecla', () => {
  it.each([
    ['[', '['],
    [']', ']'],
    ['J', 'j'],
    ['k', 'k'],
    ['F2', 'F2'],
    ['F1', 'F1'],
    ['?', '?'],
    ['d', 'd'],
    ['Escape', 'Escape'],
  ])('%s → %s', (key, esperado) => {
    expect(nombreDeTecla(tecla(key))).toBe(esperado);
  });

  it('Ctrl+Enter (o Cmd+Enter) es un atajo; Enter solo, no', () => {
    expect(nombreDeTecla(tecla('Enter', { ctrlKey: true }))).toBe('Ctrl+Enter');
    expect(nombreDeTecla(tecla('Enter', { metaKey: true }))).toBe('Ctrl+Enter');
    expect(nombreDeTecla(tecla('Enter'))).toBeNull();
  });

  it('ignora Ctrl+J, Alt+J y Cmd+J para no pisar los atajos del sistema', () => {
    expect(nombreDeTecla(tecla('j', { ctrlKey: true }))).toBeNull();
    expect(nombreDeTecla(tecla('j', { altKey: true }))).toBeNull();
    expect(nombreDeTecla(tecla('j', { metaKey: true }))).toBeNull();
  });

  it('acepta "[" escrito con AltGr (Ctrl+Alt en Windows con teclado español)', () => {
    expect(nombreDeTecla(tecla('[', { ctrlKey: true, altKey: true }))).toBe('[');
  });

  it('ignora teclas sin atajo', () => {
    expect(nombreDeTecla(tecla('ArrowDown'))).toBeNull();
    expect(nombreDeTecla(tecla('Shift'))).toBeNull();
  });
});

describe('esCampoDeEntrada', () => {
  it.each(['INPUT', 'textarea', 'Select'])('%s es un campo', (tagName) => {
    expect(esCampoDeEntrada({ tagName })).toBe(true);
  });

  it('un contenteditable es un campo', () => {
    expect(esCampoDeEntrada({ tagName: 'DIV', isContentEditable: true })).toBe(true);
  });

  it.each([{ tagName: 'BUTTON' }, { tagName: 'DIV' }, null, undefined, 'texto'])('%j no lo es', (destino) => {
    expect(esCampoDeEntrada(destino)).toBe(false);
  });
});

describe('resolverAtajo', () => {
  const cuerpo = { tagName: 'BODY' };
  const campo = { tagName: 'INPUT' };

  it('devuelve la acción del mapa para la tecla pulsada', () => {
    const colapsar = vi.fn();
    resolverAtajo({ '[': colapsar }, tecla('['), cuerpo)?.();
    expect(colapsar).toHaveBeenCalledTimes(1);
  });

  it('dentro de un input solo Esc y Ctrl+Enter siguen activos', () => {
    const mapa = { '[': vi.fn(), j: vi.fn(), F2: vi.fn(), Escape: vi.fn(), 'Ctrl+Enter': vi.fn() };
    expect(resolverAtajo(mapa, tecla('['), campo)).toBeNull();
    expect(resolverAtajo(mapa, tecla('j'), campo)).toBeNull();
    expect(resolverAtajo(mapa, tecla('F2'), campo)).toBeNull();
    expect(resolverAtajo(mapa, tecla('Escape'), campo)).toBe(mapa.Escape);
    expect(resolverAtajo(mapa, tecla('Enter', { ctrlKey: true }), campo)).toBe(mapa['Ctrl+Enter']);
  });

  it('no resuelve teclas ausentes del mapa ni propiedades heredadas', () => {
    expect(resolverAtajo({ j: vi.fn() }, tecla('k'), cuerpo)).toBeNull();
    expect(resolverAtajo({}, tecla('Escape'), cuerpo)).toBeNull();
    expect(resolverAtajo({}, tecla('constructor'), cuerpo)).toBeNull();
  });
});

describe('GRUPOS_ATAJOS', () => {
  it('agrupa en Navegación, Llamadas, Despacho y Paneles, en ese orden', () => {
    expect(GRUPOS_ATAJOS.map((g) => g.id)).toEqual(['navegacion', 'llamadas', 'despacho', 'paneles']);
  });

  it('no repite un atajo dentro de su grupo ni deja grupos vacíos', () => {
    for (const g of GRUPOS_ATAJOS) {
      expect(g.atajos.length).toBeGreaterThan(0);
      expect(new Set(g.atajos.map((a) => a.clave)).size).toBe(g.atajos.length);
    }
  });

  it('recoge los atajos que la consola atiende: J, K, F2, D, [, ], F1, ? y Esc', () => {
    const teclas = new Set<string>(GRUPOS_ATAJOS.flatMap((g) => g.atajos.flatMap((a) => a.teclas)));
    for (const t of ['J', 'K', 'F2', 'D', '[', ']', 'F1', '?', 'Esc', 'Enter', 'Ctrl+Enter']) expect(teclas.has(t)).toBe(true);
  });
});
