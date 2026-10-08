// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { IdiomaProvider } from './i18n/IdiomaProvider';

// MapLibre necesita WebGL, que jsdom no tiene: el mapa se sustituye por un hueco.
vi.mock('./layout/MapaTactico', () => ({ MapaTactico: () => null }));

beforeEach(() => {
  localStorage.clear();
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

const filaFuga = () => screen.findByRole('button', { name: /Fuga de gas en sector/ });

async function abrirConsola() {
  render(
    <IdiomaProvider inicial="es">
      <App />
    </IdiomaProvider>,
  );
  await screen.findByRole('banner', { name: 'Barra de estado' });
  await filaFuga(); // espera a que lleguen los datos del demo
}

const progreso = () => screen.getByRole('dialog', { name: 'Tutorial guiado' }).querySelector('.ag-coach__progreso')?.textContent;
async function siguiente(veces: number) {
  for (let n = 0; n < veces; n++) await userEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
}

describe('App: tutorial guiado', () => {
  it('en el primer arranque invita al recorrido sin abrirlo; «Ahora no» no vuelve a insistir', async () => {
    await abrirConsola();
    expect(screen.getByRole('region', { name: 'Invitación al tutorial' })).toBeTruthy();
    expect(screen.queryByRole('dialog', { name: 'Tutorial guiado' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('region', { name: 'Invitación al tutorial' })).toBeNull();
    expect(localStorage.getItem('argos.tutorialVisto')).toBe('true');
  });

  it('no invita si el tutorial ya se vio', async () => {
    localStorage.setItem('argos.tutorialVisto', 'true');
    await abrirConsola();
    expect(screen.queryByRole('region', { name: 'Invitación al tutorial' })).toBeNull();
  });

  it('«Hacer recorrido» abre el tutorial en el paso 1 y Esc lo cierra', async () => {
    await abrirConsola();
    await userEvent.click(screen.getByRole('button', { name: 'Hacer recorrido' }));
    expect(progreso()).toBe('1/11');
    expect(screen.queryByRole('region', { name: 'Invitación al tutorial' })).toBeNull();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Tutorial guiado' })).toBeNull();
  });

  it('desde Ajustes → Ayuda → «Ver tutorial» cierra los ajustes y empieza el recorrido', async () => {
    localStorage.setItem('argos.tutorialVisto', 'true');
    await abrirConsola();
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Ver tutorial' }));
    expect(screen.queryByRole('dialog', { name: 'Ajustes' })).toBeNull();
    expect(progreso()).toBe('1/11');
  });

  it('desde la hoja de atajos (F1) se puede lanzar el tutorial', async () => {
    localStorage.setItem('argos.tutorialVisto', 'true');
    await abrirConsola();
    await userEvent.keyboard('{F1}');
    await userEvent.click(await screen.findByRole('button', { name: 'Ver el tutorial guiado' }));
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).toBeNull();
    expect(progreso()).toBe('1/11');
  });

  it('el recorrido pausa los atajos de la consola y el paso del registro avanza solo con F2', async () => {
    await abrirConsola();
    await userEvent.click(screen.getByRole('button', { name: 'Hacer recorrido' }));
    await userEvent.keyboard('j');
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('false');
    await siguiente(3);
    expect(progreso()).toBe('4/11');
    await userEvent.keyboard('{F2}');
    expect(progreso()).toBe('5/11');
    expect(await screen.findByRole('dialog', { name: 'Registro de llamada' })).toBeTruthy();
    await siguiente(1); // 6/11: el formulario que abrió el recorrido se cierra
    expect(progreso()).toBe('6/11');
    expect(screen.queryByRole('dialog', { name: 'Registro de llamada' })).toBeNull();
  });

  it('los pasos del incidente seleccionan el primero y abren su detalle; al terminar, F1 vuelve a funcionar', async () => {
    await abrirConsola();
    await userEvent.click(screen.getByRole('button', { name: 'Hacer recorrido' }));
    await siguiente(7);
    expect(progreso()).toBe('8/11');
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('true');
    expect(await screen.findByRole('region', { name: 'Ficha del incidente' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    await userEvent.keyboard('{F1}');
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
  });
});
