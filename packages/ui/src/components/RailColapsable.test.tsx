// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RailColapsable } from './RailColapsable';
import css from './RailColapsable.css?raw';

afterEach(cleanup);

describe('RailColapsable', () => {
  it('expandido muestra el contenido y expone aria-expanded y data-colapsado', () => {
    const { container } = render(
      <RailColapsable label="Cola de incidentes" side="left" collapsed={false} onToggle={() => {}}>
        <p>contenido</p>
      </RailColapsable>,
    );
    const raiz = container.querySelector('.ag-rail');
    expect(raiz?.getAttribute('data-colapsado')).toBe('false');
    expect(raiz?.getAttribute('data-lado')).toBe('left');
    expect(screen.getByText('contenido')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Colapsar Cola de incidentes' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('plegado oculta el contenido y deja el rótulo y el icono en el rail', () => {
    const { container } = render(
      <RailColapsable label="Detalle" side="right" collapsed icon={<i data-testid="icono" />} onToggle={() => {}}>
        <p>contenido</p>
      </RailColapsable>,
    );
    expect(container.querySelector('.ag-rail')?.getAttribute('data-colapsado')).toBe('true');
    expect(screen.getByText('contenido').closest('[hidden]')).not.toBeNull();
    expect(container.querySelector('.ag-rail__body')?.hasAttribute('hidden')).toBe(true);
    expect(screen.getByTestId('icono')).toBeTruthy();
    expect(container.querySelector('.ag-rail__label')?.textContent).toBe('Detalle');
    const boton = screen.getByRole('button', { name: 'Expandir Detalle' });
    expect(boton.getAttribute('aria-expanded')).toBe('false');
    expect(boton.getAttribute('aria-controls')).toBe(container.querySelector('.ag-rail__body')?.id);
  });

  it('el botón dispara onToggle y anuncia la tecla de atajo', async () => {
    const alternar = vi.fn();
    render(
      <RailColapsable label="Cola" side="left" collapsed={false} shortcut="[" onToggle={alternar}>
        <p>x</p>
      </RailColapsable>,
    );
    const boton = screen.getByRole('button', { name: 'Colapsar Cola' });
    expect(boton.getAttribute('aria-keyshortcuts')).toBe('[');
    expect(boton.getAttribute('title')).toBe('Colapsar Cola ([)');
    await userEvent.click(boton);
    expect(alternar).toHaveBeenCalledTimes(1);
  });

  it('la flecha apunta hacia el borde donde se pliega', () => {
    const { container, rerender } = render(
      <RailColapsable label="Cola" side="left" collapsed={false} onToggle={() => {}}>
        <p>x</p>
      </RailColapsable>,
    );
    expect(container.querySelector('.ag-rail__arrow')?.textContent).toBe('«');
    rerender(
      <RailColapsable label="Cola" side="left" collapsed onToggle={() => {}}>
        <p>x</p>
      </RailColapsable>,
    );
    expect(container.querySelector('.ag-rail__arrow')?.textContent).toBe('»');
    rerender(
      <RailColapsable label="Detalle" side="right" collapsed={false} onToggle={() => {}}>
        <p>x</p>
      </RailColapsable>,
    );
    expect(container.querySelector('.ag-rail__arrow')?.textContent).toBe('»');
  });

  it('no usa colores sueltos en su hoja de estilos', () => {
    expect(css).toContain('.ag-rail');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
