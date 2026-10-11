// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { crearEntornoSemilla } from '../testing/entornoSemilla';

// MapLibre necesita WebGL, que jsdom no tiene: el mapa se sustituye por un hueco.
vi.mock('./MapaTactico', () => ({ MapaTactico: () => null }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

// Cada caso monta la App completa y encadena varias interacciones: con la suite entera en paralelo 5 s se queda corto.
vi.setConfig({ testTimeout: 20_000 });

const REGION = { name: 'Asesor táctico · motor de reglas' };

async function abrirConsola() {
  render(
    <IdiomaProvider inicial="es">
      <App crearEntorno={crearEntornoSemilla} />
    </IdiomaProvider>,
  );
  await screen.findByRole('banner', { name: 'Barra de estado' });
  await screen.findByRole('button', { name: /Fuga de gas en sector/ });
}

/** Libera la U02 del demo para que el asesor tenga una unidad que proponer, y abre su tarjeta. */
async function abrirTarjetaDelAsesor() {
  await abrirConsola();
  await userEvent.keyboard('j');
  await userEvent.click(await screen.findByRole('button', { name: 'Liberar U02' }));
  await userEvent.keyboard('a');
  await screen.findByText('Unidades recomendadas', undefined, { timeout: 3000 });
}

const soltarFoco = () => (document.activeElement instanceof HTMLElement ? document.activeElement.blur() : undefined);

describe('Esc con varias capas abiertas cierra solo la de arriba (QA H14)', () => {
  it('Esc en el formulario de llamada no cierra además la tarjeta del asesor', async () => {
    await abrirTarjetaDelAsesor();
    await userEvent.keyboard('{F2}');
    expect(await screen.findByRole('dialog', { name: 'Registro de llamada' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Registro de llamada' })).toBeNull();
    expect(screen.getByRole('region', REGION)).toBeTruthy();
    // Un segundo Esc ya sí cierra la tarjeta.
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', REGION)).toBeNull();
  });

  it('Esc en la confirmación del plan deja la tarjeta abierta aunque el foco esté fuera y los atajos se hayan reenganchado', async () => {
    await abrirTarjetaDelAsesor();
    await userEvent.click(screen.getByRole('button', { name: 'APLICAR SUGERENCIA' }));
    await screen.findByRole('dialog', { name: /^Aplicar sugerencia · #/ });
    // Abrir y cerrar la hoja de atajos vuelve a registrar el listener global después del de la confirmación.
    soltarFoco();
    await userEvent.keyboard('{F1}');
    await screen.findByRole('dialog', { name: 'Atajos de teclado' });
    await userEvent.keyboard('{F1}');
    soltarFoco();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /^Aplicar sugerencia · #/ })).toBeNull();
    expect(screen.getByRole('region', REGION)).toBeTruthy();
  });

  it('Esc con el foco fuera del despacho lo cancela igualmente', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('d');
    await screen.findByRole('dialog', { name: /^Despachar · #/ });
    soltarFoco();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /^Despachar · #/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'P01, Policía, Disponible' })).toBeTruthy();
  });
});
