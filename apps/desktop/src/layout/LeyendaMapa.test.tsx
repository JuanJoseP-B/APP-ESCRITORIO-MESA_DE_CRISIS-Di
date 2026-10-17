// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CAPAS_POR_DEFECTO } from '../domain/capasMapa';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { LeyendaMapa } from './LeyendaMapa';
import css from './LeyendaMapa.css?raw';

// Las pruebas de contenido parten con la leyenda desplegada; la de arranque limpia el almacenamiento.
beforeEach(() => localStorage.setItem('argos.leyendaPlegada', 'false'));
afterEach(cleanup);

const montar = (extra: Partial<Parameters<typeof LeyendaMapa>[0]> = {}) =>
  render(<LeyendaMapa capas={CAPAS_POR_DEFECTO} onCambiarCapa={vi.fn()} {...extra} />);

const textos = (nombre: string): (string | null)[] =>
  within(screen.getByRole('list', { name: nombre })).getAllByRole('listitem').map((i) => i.textContent);

describe('LeyendaMapa', () => {
  it('lista los símbolos de incidentes y zonas públicas, cada uno con glifo y palabra', () => {
    const { container } = montar();
    expect(textos('Incidentes')).toEqual(['Incidente crítico', 'Incidente medio', 'Incidente bajo', 'Llamada sin confirmar']);
    expect(textos('Zonas públicas')).toEqual(['Refugio', 'Bloqueo de vía']);
    for (const nombre of ['Incidentes', 'Zonas públicas']) {
      const items = within(screen.getByRole('list', { name: nombre })).getAllByRole('listitem');
      expect(items.every((i) => i.querySelector('.ag-glyph') !== null)).toBe(true);
    }
    expect(container.querySelector('section')).not.toBeNull();
  });

  it('la criticidad no depende solo del color: cada nivel usa una forma distinta', () => {
    montar();
    const formas = within(screen.getByRole('list', { name: 'Incidentes' }))
      .getAllByRole('listitem')
      .slice(0, 3)
      .map((li) => [...(li.querySelector('.ag-glyph')?.classList ?? [])].find((c) => c.startsWith('ag-glyph--')));
    expect(new Set(formas).size).toBe(3);
  });

  it('explica las unidades: tipos, los cinco estados, la alerta y el recorrido', () => {
    montar();
    expect(textos('Unidades')).toEqual([
      'Bomberos',
      'Ambulancia',
      'Policía',
      'Disponible',
      'Despachado',
      'En ruta',
      'En escena',
      'Inoperativo',
      'Unidad en zona caliente',
      'Recorrido restante',
    ]);
  });

  it('explica los tres anillos del perímetro con trazos distintos', () => {
    const { container } = montar();
    expect(textos('Perímetro de riesgo')).toEqual(['Zona caliente', 'Zona tibia', 'Zona de evacuación']);
    expect(container.querySelector('.ag-leyenda__trazo--CALIENTE')).not.toBeNull();
    expect(css).toMatch(/--TIBIA \{ border-top-style: dashed/);
    expect(css).toMatch(/--EVACUACION \{ border-top-style: dotted/);
  });

  it('usa clases semánticas de estado, sin colores sueltos ni transparencias', () => {
    const { container } = montar();
    const clases = container.innerHTML;
    expect(clases).toContain('text-status-critical');
    expect(clases).toContain('text-status-warning');
    expect(clases).toContain('text-status-success');
    expect(clases).not.toMatch(/bg-\[|text-\[|backdrop-blur|\/\d+"/);
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|backdrop|gradient/i);
  });
});

describe('LeyendaMapa: plegado', () => {
  it('el primer arranque la deja plegada para no tapar el mapa, y se despliega con su cabecera, recordándolo', async () => {
    localStorage.clear();
    montar();
    const cabecera = screen.getByRole('button', { name: /Leyenda/ });
    expect(cabecera.getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByRole('list', { name: 'Unidades' })).toBeNull();
    await userEvent.click(cabecera);
    expect(cabecera.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('list', { name: 'Unidades' })).toBeTruthy();
    expect(localStorage.getItem('argos.leyendaPlegada')).toBe('false');
    await userEvent.click(cabecera);
    expect(localStorage.getItem('argos.leyendaPlegada')).toBe('true');
  });

  it('si la última vez quedó desplegada, vuelve desplegada', () => {
    montar();
    expect(screen.getByRole('button', { name: /Leyenda/ }).getAttribute('aria-expanded')).toBe('true');
  });

  it('si la última vez quedó plegada, vuelve plegada', () => {
    localStorage.setItem('argos.leyendaPlegada', 'true');
    montar();
    expect(screen.getByRole('button', { name: /Leyenda/ }).getAttribute('aria-expanded')).toBe('false');
  });
});

describe('LeyendaMapa: capas', () => {
  it('un interruptor por capa, con su estado en palabras', () => {
    montar({ capas: { ...CAPAS_POR_DEFECTO, perimetros: false } });
    const grupo = screen.getByRole('group', { name: 'Capas' });
    const interruptores = within(grupo).getAllByRole('switch');
    expect(interruptores.map((i) => [i.getAttribute('aria-checked'), i.textContent])).toEqual([
      ['true', 'Visible'],
      ['false', 'Oculta'],
      ['true', 'Visible'],
      ['true', 'Visible'],
    ]);
    expect(interruptores.map((i) => i.getAttribute('aria-labelledby')).every(Boolean)).toBe(true);
    expect(within(grupo).getByRole('switch', { name: 'Perímetros' })).toBeTruthy();
  });

  it('accionar un interruptor avisa de qué capa se trata', async () => {
    const onCambiarCapa = vi.fn();
    montar({ onCambiarCapa });
    await userEvent.click(screen.getByRole('switch', { name: 'Unidades' }));
    await userEvent.click(screen.getByRole('switch', { name: 'Bloqueos' }));
    expect(onCambiarCapa.mock.calls).toEqual([['unidades'], ['bloqueos']]);
  });
});

describe('LeyendaMapa: idioma', () => {
  it('se traduce al inglés', () => {
    render(
      <IdiomaProvider inicial="en">
        <LeyendaMapa capas={CAPAS_POR_DEFECTO} onCambiarCapa={vi.fn()} />
      </IdiomaProvider>,
    );
    expect(screen.getByRole('list', { name: 'Risk perimeter' })).toBeTruthy();
    expect(screen.getByRole('switch', { name: 'Shelters' }).textContent).toBe('Visible');
    expect(screen.getByRole('group', { name: 'Layers' })).toBeTruthy();
  });
});
