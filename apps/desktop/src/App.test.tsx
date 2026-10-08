// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { IdiomaProvider } from './i18n/IdiomaProvider';

// MapLibre necesita WebGL, que jsdom no tiene: el mapa se sustituye por un hueco.
vi.mock('./layout/MapaTactico', () => ({ MapaTactico: () => null }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

async function abrirConsola() {
  render(
    <IdiomaProvider inicial="es">
      <App />
    </IdiomaProvider>,
  );
  await screen.findByRole('banner', { name: 'Barra de estado' });
  await filaFuga(); // espera a que lleguen los datos del demo
}

function filaFuga() {
  return screen.findByRole('button', { name: /Fuga de gas en sector/ });
}

describe('App: atajos de navegación y despacho', () => {
  it('J selecciona el primer incidente de la cola y abre su detalle', async () => {
    await abrirConsola();
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('false');
    await userEvent.keyboard('j');
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('true');
    expect(await screen.findByRole('region', { name: 'Ficha del incidente' })).toBeTruthy();
  });

  it('D sin incidente seleccionado no hace nada', async () => {
    await abrirConsola();
    await userEvent.keyboard('d');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('D abre el despacho con la unidad libre más cercana preseleccionada, y Enter la despacha', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('d');
    const dialogo = await screen.findByRole('dialog', { name: /^Despachar · #/ });
    const sugerida = within(dialogo).getByRole('radio', { name: /P01/ }) as HTMLInputElement;
    expect(sugerida.checked).toBe(true);
    expect(document.activeElement).toBe(sugerida);

    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('dialog', { name: /^Despachar · #/ })).toBeNull();
    expect(await screen.findByRole('button', { name: /^P01, Policía, Despachado/ })).toBeTruthy();
  });

  it('Esc cancela el despacho sin asignar nada', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('d');
    await screen.findByRole('dialog', { name: /^Despachar · #/ });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /^Despachar · #/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'P01, Policía, Disponible' })).toBeTruthy();
  });

  it('el botón «Despachar unidad» del detalle abre el mismo despacho', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.click(await screen.findByRole('button', { name: /^Despachar unidad/ }));
    expect(await screen.findByRole('dialog', { name: /^Despachar · #/ })).toBeTruthy();
  });

  it('los atajos no se disparan escribiendo en un campo', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('{F2}');
    const campo = await screen.findByLabelText('Latitud');
    await userEvent.click(campo);
    await userEvent.keyboard('d');
    expect(screen.queryByRole('dialog', { name: /^Despachar · #/ })).toBeNull();
    expect((campo as HTMLInputElement).value).toContain('d');
  });
});

describe('App: hoja de atajos', () => {
  it('F1 abre la hoja y F1 de nuevo la cierra', async () => {
    await abrirConsola();
    await userEvent.keyboard('{F1}');
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
    await userEvent.keyboard('{F1}');
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).toBeNull();
  });

  it('«?» la abre y Esc la cierra devolviendo el foco', async () => {
    await abrirConsola();
    const fila = await filaFuga();
    fila.focus();
    await userEvent.keyboard('?');
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).toBeNull();
    expect(document.activeElement).toBe(fila);
  });

  it('con la hoja abierta los demás atajos no actúan', async () => {
    await abrirConsola();
    await userEvent.keyboard('{F1}');
    await screen.findByRole('dialog', { name: 'Atajos de teclado' });
    await userEvent.keyboard('j');
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('false');
  });

  it('desde Ajustes → Ayuda cierra los ajustes y abre la hoja', async () => {
    await abrirConsola();
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Atajos de teclado' }));
    expect(screen.queryByRole('dialog', { name: 'Ajustes' })).toBeNull();
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
  });
});
