// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { IdiomaProvider } from './i18n/IdiomaProvider';

// MapLibre necesita WebGL, que jsdom no tiene: el mapa se sustituye por un hueco.
vi.mock('./layout/MapaTactico', () => ({ MapaTactico: () => null }));

beforeEach(() => {
  localStorage.setItem('argos.tutorialVisto', 'true');
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(() => {
  cleanup();
  localStorage.clear();
});

async function abrirConsola() {
  render(
    <IdiomaProvider inicial="es">
      <App />
    </IdiomaProvider>,
  );
  await screen.findByRole('banner', { name: 'Barra de estado' });
  await screen.findByText('6/6 disp.'); // llegaron las unidades del demo
}

describe('App: escenarios del demo', () => {
  it('arranca limpio: sin incidentes ni llamadas y las 6 unidades disponibles', async () => {
    await abrirConsola();
    expect(screen.getByText('Sin incidentes activos')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Fuga de gas en sector/ })).toBeNull();
    expect(screen.getByRole('status', { name: '0 llamadas entrantes' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'A' }).getAttribute('aria-checked')).toBe('true');
  });

  it('cambiar de escenario antes de iniciar monta sus datos: el B trae sus refugios presionados', async () => {
    await abrirConsola();
    expect(screen.queryByText('Salón Comunal Lorenzo')).toBeNull();
    await userEvent.click(screen.getByRole('radio', { name: 'B' }));
    expect(await screen.findByText('Salón Comunal Lorenzo')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'B' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(screen.getByRole('radio', { name: 'C' }));
    await screen.findByText('6/6 disp.');
    expect(screen.queryByText('Salón Comunal Lorenzo')).toBeNull();
  });

  it('al iniciar el escenario el selector desaparece y Reiniciar lo devuelve al estado limpio del mismo escenario', async () => {
    await abrirConsola();
    await userEvent.click(screen.getByRole('radio', { name: 'B' }));
    await screen.findByText('Salón Comunal Lorenzo');
    await userEvent.click(screen.getByRole('button', { name: /Iniciar escenario/i }));
    expect(screen.queryByRole('radiogroup', { name: 'Escenario del demo' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Reiniciar' }));
    expect(await screen.findByRole('radio', { name: 'B' })).toBeTruthy(); // vuelve el selector, con el escenario B
    expect(screen.getByRole('radio', { name: 'B' }).getAttribute('aria-checked')).toBe('true');
    expect(await screen.findByText('6/6 disp.')).toBeTruthy();
  });
});
