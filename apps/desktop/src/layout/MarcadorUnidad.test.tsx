// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UnidadMapa } from '../domain/unidadesMapa';
import { MarcadorUnidad } from './MarcadorUnidad';
import css from './MarcadorUnidad.css?raw';

afterEach(cleanup);

const unidad = (extra: Partial<UnidadMapa> = {}): UnidadMapa => ({
  id: 'r1',
  indicativo: 'M11',
  tipo: 'Ambulancia',
  estado: 'EN_RUTA',
  incidenteId: null,
  posicion: { lat: 1.2, lng: -77.2 },
  atenuada: false,
  ...extra,
});

describe('MarcadorUnidad', () => {
  it('muestra el indicativo completo y el estado con glifo y palabra', () => {
    const { container } = render(<MarcadorUnidad unidad={unidad()} seleccionada={false} onSeleccionar={vi.fn()} />);
    expect(screen.getByText('M11')).toBeTruthy();
    expect(container.querySelector('.ag-marcador__estado')?.textContent).toBe('RUTA');
    expect(container.querySelector('.ag-marcador__estado .ag-glyph')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'M11, Ambulancia, En ruta' })).toBeTruthy();
  });

  it('usa un glifo distinto por tipo de unidad', () => {
    const glifos = (['Bomberos', 'Ambulancia', 'Policía'] as const).map((tipo) => {
      const { container, unmount } = render(<MarcadorUnidad unidad={unidad({ tipo })} seleccionada={false} onSeleccionar={vi.fn()} />);
      const svg = container.querySelector('svg')?.innerHTML ?? '';
      unmount();
      return svg;
    });
    expect(new Set(glifos).size).toBe(3);
    expect(glifos.every((g) => g.length > 0)).toBe(true);
  });

  it('una unidad atenuada lo declara; una seleccionada se marca como pulsada', () => {
    const { container, rerender } = render(<MarcadorUnidad unidad={unidad({ atenuada: true })} seleccionada={false} onSeleccionar={vi.fn()} />);
    expect(container.querySelector('[data-atenuada="true"]')).not.toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('false');
    rerender(<MarcadorUnidad unidad={unidad()} seleccionada onSeleccionar={vi.fn()} />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });

  it('dentro de la zona caliente muestra la alerta con glifo y palabra, y la anuncia', () => {
    const { container } = render(<MarcadorUnidad unidad={unidad()} seleccionada={false} onSeleccionar={vi.fn()} alerta />);
    expect(container.querySelector('.ag-marcador__alerta')?.textContent).toBe('CALIENTE');
    expect(container.querySelector('.ag-marcador__alerta .ag-glyph')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'M11, Ambulancia, En ruta, dentro de la zona caliente' })).toBeTruthy();
  });

  it('sin alerta no muestra el rótulo; resaltada lo declara', () => {
    const { container } = render(<MarcadorUnidad unidad={unidad()} seleccionada={false} onSeleccionar={vi.fn()} resaltada />);
    expect(container.querySelector('.ag-marcador__alerta')).toBeNull();
    expect(container.querySelector('[data-resaltada="true"]')).not.toBeNull();
  });

  it('el clic entrega el id y no se propaga al mapa', async () => {
    const elegir = vi.fn();
    const alMapa = vi.fn();
    render(
      <div onClick={alMapa}>
        <MarcadorUnidad unidad={unidad()} seleccionada={false} onSeleccionar={elegir} />
      </div>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(elegir).toHaveBeenCalledWith('r1');
    expect(alMapa).not.toHaveBeenCalled();
  });

  it('el color de cada estado sale de tokens, sin hex ni transparencias de fondo', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|rgba\(|backdrop|gradient/i);
    for (const estado of ['disponible', 'despachado', 'enruta', 'escena', 'inoperativo']) {
      expect(css).toContain(`ag-marcador--${estado}`);
    }
  });
});
