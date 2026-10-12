// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { PreferenciasProvider } from './hooks/usePreferencias';
import { IdiomaProvider } from './i18n/IdiomaProvider';
import { crearEntornoSemilla } from './testing/entornoSemilla';

// MapLibre necesita WebGL, que jsdom no tiene: el mapa se sustituye por un hueco.
vi.mock('./layout/MapaTactico', () => ({ MapaTactico: () => null }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function abrirConsola() {
  render(
    <IdiomaProvider inicial="es">
      <PreferenciasProvider>
        <App crearEntorno={crearEntornoSemilla} />
      </PreferenciasProvider>
    </IdiomaProvider>,
  );
  await screen.findByRole('button', { name: /Fuga de gas en sector/ });
}

const arranque = () => screen.queryByRole('dialog', { name: 'Iniciando ARGOS' });

describe('App: secuencia de arranque', () => {
  it('sale al entrar, apaga los atajos de la consola y Esc la salta', async () => {
    await abrirConsola();
    expect(arranque()).toBeTruthy();
    // El mapa no llegó a cargar (está sustituido): la línea no finge un ✓.
    expect(screen.getByText('Cartografía táctica').closest('li')?.textContent).not.toContain('✓');

    await userEvent.keyboard('j');
    expect(screen.getByRole('button', { name: /Fuga de gas en sector/ }).getAttribute('aria-pressed')).toBe('false');

    await userEvent.keyboard('{Escape}');
    expect(arranque()).toBeNull();
    await userEvent.keyboard('j');
    expect(screen.getByRole('button', { name: /Fuga de gas en sector/ }).getAttribute('aria-pressed')).toBe('true');
  });

  it('con «Mostrar secuencia de arranque» apagado no sale', async () => {
    localStorage.setItem('argos.mostrarArranque', 'false');
    await abrirConsola();
    expect(arranque()).toBeNull();
  });

  it('el ajuste se apaga desde Ajustes y queda guardado', async () => {
    await abrirConsola();
    await userEvent.keyboard('{Enter}');
    expect(arranque()).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    await userEvent.click(screen.getByRole('switch', { name: /Mostrar secuencia de arranque/ }));
    expect(localStorage.getItem('argos.mostrarArranque')).toBe('false');
  });
});
