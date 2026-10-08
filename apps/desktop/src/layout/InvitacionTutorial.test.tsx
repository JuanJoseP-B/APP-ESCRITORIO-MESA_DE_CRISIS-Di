// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_TUTORIAL_VISTO } from '../domain/tutorial';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { InvitacionTutorial } from './InvitacionTutorial';
import { TutorialProvider } from './TutorialProvider';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

const preparacion = { expandirCola: vi.fn(), expandirDetalle: vi.fn(), seleccionarPrimero: vi.fn(), cerrarFormulario: vi.fn() };

const montar = (idioma: 'es' | 'en' = 'es') =>
  render(
    <IdiomaProvider inicial={idioma}>
      <TutorialProvider preparacion={preparacion}>
        <InvitacionTutorial />
      </TutorialProvider>
    </IdiomaProvider>,
  );

describe('InvitacionTutorial', () => {
  it('en el primer arranque ofrece el recorrido sin abrirlo ni robar el foco', () => {
    montar();
    expect(screen.getByRole('region', { name: 'Invitación al tutorial' })).toBeTruthy();
    expect(screen.getByText('¿Primera vez en ARGOS?')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(document.body);
  });

  it('«Hacer recorrido» abre el tutorial y retira la invitación', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Hacer recorrido' }));
    expect(screen.getByRole('dialog', { name: 'Tutorial guiado' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Invitación al tutorial' })).toBeNull();
  });

  it('«Ahora no» la retira para siempre y no abre nada', async () => {
    montar();
    await userEvent.click(screen.getByRole('button', { name: 'Ahora no' }));
    expect(screen.queryByRole('region', { name: 'Invitación al tutorial' })).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(CLAVE_TUTORIAL_VISTO)).toBe('true');
  });

  it('no aparece si el tutorial ya se vio', () => {
    localStorage.setItem(CLAVE_TUTORIAL_VISTO, 'true');
    montar();
    expect(screen.queryByRole('region', { name: 'Invitación al tutorial' })).toBeNull();
  });

  it('se traduce al inglés', () => {
    montar('en');
    expect(screen.getByText('First time in ARGOS?')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Take the tour' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Not now' })).toBeTruthy();
  });

  it('sin proveedor no renderiza nada', () => {
    const { container } = render(
      <IdiomaProvider>
        <InvitacionTutorial />
      </IdiomaProvider>,
    );
    expect(container.textContent).toBe('');
  });
});
