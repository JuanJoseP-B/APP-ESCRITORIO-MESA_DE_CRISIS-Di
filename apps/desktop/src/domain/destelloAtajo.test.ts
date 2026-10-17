// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { coincideTeclaConKbd, destellarAtajo } from './destelloAtajo';

afterEach(cleanup);

describe('coincideTeclaConKbd', () => {
  it('coincide de forma insensible a mayúsculas', () => {
    expect(coincideTeclaConKbd('d', 'D')).toBe(true);
    expect(coincideTeclaConKbd('a', 'A')).toBe(true);
    expect(coincideTeclaConKbd('j', 'J')).toBe(true);
    expect(coincideTeclaConKbd('k', 'K')).toBe(true);
    expect(coincideTeclaConKbd('F1', 'F1')).toBe(true);
    expect(coincideTeclaConKbd('F2', 'F2')).toBe(true);
    expect(coincideTeclaConKbd('[', '[')).toBe(true);
    expect(coincideTeclaConKbd(']', ']')).toBe(true);
  });

  it('resuelve alias de Escape y ?', () => {
    expect(coincideTeclaConKbd('Escape', 'Esc')).toBe(true);
    expect(coincideTeclaConKbd('Esc', 'Escape')).toBe(true);
    expect(coincideTeclaConKbd('?', 'F1')).toBe(true);
    expect(coincideTeclaConKbd('Ctrl+Enter', 'Ctrl+Enter')).toBe(true);
  });

  it('no coincide con teclas no relacionadas', () => {
    expect(coincideTeclaConKbd('d', 'A')).toBe(false);
    expect(coincideTeclaConKbd('F1', 'F2')).toBe(false);
  });
});

describe('destellarAtajo', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('aplica la clase y atributo de destello a los kbd coincidentes y los retira tras --dur-fast', () => {
    const contenedor = document.createElement('div');
    contenedor.innerHTML = `
      <button>Despachar <kbd class="ag-kbd">D</kbd></button>
      <button>Asesor <kbd class="ag-kbd">A</kbd></button>
      <button>Registrar <kbd class="ag-kbd">F2</kbd></button>
    `;
    document.body.appendChild(contenedor);

    const kbdD = contenedor.querySelectorAll('kbd')[0];
    const kbdA = contenedor.querySelectorAll('kbd')[1];
    const kbdF2 = contenedor.querySelectorAll('kbd')[2];

    expect(kbdD?.classList.contains('ag-kbd--destello')).toBe(false);

    destellarAtajo('d', contenedor);

    expect(kbdD?.classList.contains('ag-kbd--destello')).toBe(true);
    expect(kbdD?.dataset.destello).toBe('true');
    expect(kbdA?.classList.contains('ag-kbd--destello')).toBe(false);
    expect(kbdF2?.classList.contains('ag-kbd--destello')).toBe(false);

    vi.advanceTimersByTime(200);

    expect(kbdD?.classList.contains('ag-kbd--destello')).toBe(false);
    expect(kbdD?.dataset.destello).toBeUndefined();

    contenedor.remove();
  });
});
