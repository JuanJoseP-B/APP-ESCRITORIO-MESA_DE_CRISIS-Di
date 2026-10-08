// @vitest-environment jsdom
import { useState } from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PreferenciasProvider } from '../hooks/usePreferencias';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { BarraEstado } from './BarraEstado';
import { PanelAjustes } from './PanelAjustes';

/** La barra con su engranaje y el panel, tal como los une la consola. */
function Consola() {
  const [abierto, setAbierto] = useState(false);
  return (
    <>
      <BarraEstado hora={Date.UTC(2026, 9, 8, 12)} zona="UTC" turno="crema" operador="op@argos.test" enlace="EN_VIVO" onAbrirAjustes={() => setAbierto(true)} />
      <button>otro control</button>
      {abierto && <PanelAjustes onCerrar={() => setAbierto(false)} />}
    </>
  );
}

const montar = () =>
  render(
    <IdiomaProvider>
      <PreferenciasProvider>
        <Consola />
      </PreferenciasProvider>
    </IdiomaProvider>,
  );

const abrir = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
  return screen.getByRole('dialog', { name: 'Ajustes' });
};

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  const { dataset } = document.documentElement;
  delete dataset['theme'];
  delete dataset['reducedMotion'];
  delete dataset['textLarge'];
  document.documentElement.lang = '';
});

describe('PanelAjustes', () => {
  it('abre como diálogo con las cuatro secciones', async () => {
    montar();
    const panel = await abrir();
    expect(panel.getAttribute('aria-modal')).toBe('true');
    for (const nombre of ['Apariencia', 'Idioma', 'Accesibilidad', 'Ayuda']) {
      expect(within(panel).getByRole('region', { name: nombre })).toBeTruthy();
    }
  });

  it('el tema cambia al instante, incluido «Sistema», y se recuerda', async () => {
    montar();
    const panel = await abrir();
    await userEvent.click(within(panel).getByRole('radio', { name: 'Carbón (noche)' }));
    expect(document.documentElement.dataset['theme']).toBe('carbon');
    expect(localStorage.getItem('argos.tema')).toBe('carbon');
    expect(within(panel).getByRole('radio', { name: 'Carbón (noche)' }).getAttribute('aria-checked')).toBe('true');
    await userEvent.click(within(panel).getByRole('radio', { name: 'Sistema' }));
    expect(localStorage.getItem('argos.tema')).toBe('sistema');
    expect(document.documentElement.dataset['theme']).toBe('crema');
  });

  it('el idioma cambia al instante y el panel se vuelve a escribir', async () => {
    montar();
    const panel = await abrir();
    await userEvent.click(within(panel).getByRole('radio', { name: 'English' }));
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Appearance' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('los interruptores de accesibilidad se aplican a <html>', async () => {
    montar();
    const panel = await abrir();
    await userEvent.click(within(panel).getByRole('switch', { name: 'Reducir movimiento' }));
    await userEvent.click(within(panel).getByRole('switch', { name: 'Texto grande' }));
    expect(document.documentElement.getAttribute('data-reduced-motion')).toBe('true');
    expect(document.documentElement.getAttribute('data-text-large')).toBe('true');
    await userEvent.click(within(panel).getByRole('switch', { name: 'Texto grande' }));
    expect(document.documentElement.hasAttribute('data-text-large')).toBe(false);
  });

  it('«Ver tutorial» está deshabilitado y lleva la etiqueta «Próximamente»', async () => {
    montar();
    const panel = await abrir();
    const boton = within(panel).getByRole('button', { name: 'Ver tutorial' }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect(within(panel).getByText('Próximamente')).toBeTruthy();
  });

  it('el foco entra en el panel y Tab da la vuelta sin salir de él', async () => {
    montar();
    const panel = await abrir();
    expect(panel.contains(document.activeElement)).toBe(true);
    for (let i = 0; i < 20; i++) {
      await userEvent.tab();
      expect(panel.contains(document.activeElement)).toBe(true);
    }
    for (let i = 0; i < 20; i++) {
      await userEvent.tab({ shift: true });
      expect(panel.contains(document.activeElement)).toBe(true);
    }
  });

  it('Esc cierra y devuelve el foco al engranaje', async () => {
    montar();
    await abrir();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ajustes' }));
  });

  it('el botón de cerrar también devuelve el foco', async () => {
    montar();
    const panel = await abrir();
    await userEvent.click(within(panel).getByRole('button', { name: 'Cerrar ajustes' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Ajustes' }));
  });
});
