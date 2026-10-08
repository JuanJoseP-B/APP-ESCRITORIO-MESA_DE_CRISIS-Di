// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GRUPOS_ATAJOS } from '../domain/atajos';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { HojaAtajos } from './HojaAtajos';

afterEach(cleanup);

const montar = (onCerrar = vi.fn(), idioma: 'es' | 'en' = 'es') => {
  const opener = document.createElement('button');
  opener.textContent = 'abrir';
  document.body.append(opener);
  opener.focus();
  const vista = render(
    <IdiomaProvider inicial={idioma}>
      <HojaAtajos onCerrar={onCerrar} />
    </IdiomaProvider>,
  );
  return { onCerrar, opener, ...vista };
};

describe('HojaAtajos', () => {
  it('es un diálogo modal con las cuatro secciones, en orden', () => {
    montar();
    const hoja = screen.getByRole('dialog', { name: 'Atajos de teclado' });
    expect(hoja.getAttribute('aria-modal')).toBe('true');
    const secciones = within(hoja).getAllByRole('region').map((r) => r.getAttribute('aria-label'));
    expect(secciones).toEqual(['Navegación', 'Llamadas', 'Despacho', 'Paneles y ayuda']);
  });

  it('lista todas las teclas, cada una dentro de un <kbd> legible', () => {
    montar();
    const hoja = screen.getByRole('dialog');
    const esperadas = GRUPOS_ATAJOS.flatMap((g) => g.atajos.flatMap((a) => a.teclas));
    const teclas = [...hoja.querySelectorAll('kbd')];
    expect(teclas.map((k) => k.textContent)).toEqual(esperadas);
    expect(teclas.every((k) => !k.hasAttribute('aria-hidden'))).toBe(true);
    for (const tecla of ['J', 'K', 'F2', 'D', 'Enter', 'Ctrl+Enter', '[', ']', 'F1', '?']) {
      expect(esperadas).toContain(tecla);
    }
  });

  it('cada atajo se explica con su texto', () => {
    montar();
    const despacho = screen.getByRole('region', { name: 'Despacho' });
    expect(within(despacho).getByText('Despachar al incidente seleccionado')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Navegación' })).getByText('Incidente siguiente de la cola')).toBeTruthy();
  });

  it('el foco entra en el botón de cerrar y Tab da la vuelta sin salir', async () => {
    montar();
    const cerrar = screen.getByRole('button', { name: 'Cerrar la hoja de atajos' });
    expect(document.activeElement).toBe(cerrar);
    await userEvent.tab();
    expect(screen.getByRole('dialog').contains(document.activeElement)).toBe(true);
    await userEvent.tab({ shift: true });
    expect(document.activeElement).toBe(cerrar);
  });

  it.each([['{Escape}'], ['{F1}'], ['?']])('%s la cierra', async (tecla) => {
    const { onCerrar } = montar();
    await userEvent.keyboard(tecla);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('al cerrarse devuelve el foco a quien la abrió', () => {
    const { opener, unmount } = montar();
    unmount();
    expect(document.activeElement).toBe(opener);
  });

  it('el botón de cerrar y el clic fuera también la cierran', async () => {
    const { onCerrar, container } = montar();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar la hoja de atajos' }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
    await userEvent.click(container.ownerDocument.querySelector('[aria-hidden="true"].fixed') as HTMLElement);
    expect(onCerrar).toHaveBeenCalledTimes(2);
  });

  it('las demás teclas no escapan a los atajos de la consola mientras está abierta', async () => {
    montar();
    const alDocumento = vi.fn();
    document.addEventListener('keydown', alDocumento);
    await userEvent.keyboard('j');
    document.removeEventListener('keydown', alDocumento);
    expect(alDocumento).not.toHaveBeenCalled();
  });

  it('está traducida al inglés', () => {
    montar(vi.fn(), 'en');
    const hoja = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(within(hoja).getAllByRole('region').map((r) => r.getAttribute('aria-label'))).toEqual(['Navigation', 'Calls', 'Dispatch', 'Panels and help']);
    expect(within(hoja).getByText('Next incident in the queue')).toBeTruthy();
  });
});
