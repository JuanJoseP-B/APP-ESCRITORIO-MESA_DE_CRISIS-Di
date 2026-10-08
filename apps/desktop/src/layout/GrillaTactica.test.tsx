// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { usePanelColapsable } from '../hooks/usePanelColapsable';
import { GrillaTactica } from './GrillaTactica';
import css from './GrillaTactica.css?raw';

afterEach(() => {
  cleanup();
  localStorage.clear();
});

function Prueba() {
  const panelCola = usePanelColapsable('cola');
  const panelDetalle = usePanelColapsable('detalle');
  return (
    <GrillaTactica
      barra={<p>barra</p>}
      cola={<p>cola</p>}
      mapa={<p>mapa</p>}
      detalle={<p>detalle</p>}
      tablero={<p>tablero</p>}
      panelCola={panelCola}
      panelDetalle={panelDetalle}
    />
  );
}

const area = (container: HTMLElement, nombre: string) => container.querySelector(`[data-area="${nombre}"]`);

describe('GrillaTactica', () => {
  it('renderiza las 5 áreas con su contenido', () => {
    const { container } = render(<Prueba />);
    for (const nombre of ['barra', 'cola', 'mapa', 'detalle', 'tablero']) {
      expect(area(container, nombre), nombre).not.toBeNull();
    }
    expect(area(container, 'barra')?.textContent).toBe('barra');
    expect(area(container, 'cola')?.textContent).toBe('cola');
    expect(area(container, 'mapa')?.textContent).toBe('mapa');
    expect(area(container, 'detalle')?.textContent).toBe('detalle');
    expect(area(container, 'tablero')?.textContent).toBe('tablero');
    expect(screen.getByRole('main').textContent).toBe('mapa');
    expect(screen.getByRole('region', { name: 'Tablero de unidades' })).toBeTruthy();
  });

  it('la página no desplaza: raíz de 100dvh con overflow oculto y solo B y D llevan rail con scroll interno', () => {
    expect(css).toMatch(/\.ag-grilla\s*\{[^}]*height:\s*100dvh;[^}]*overflow:\s*hidden;/);
    expect(css).toMatch(/grid-template-rows:\s*var\(--grilla-barra\)\s+minmax\(0,\s*1fr\)\s+var\(--grilla-tablero\)/);
    // Ninguna regla de la grilla permite desplazar la página: no hay overflow auto ni scroll en la hoja.
    expect(css).not.toMatch(/overflow(-y)?:\s*(auto|scroll)/);
    const { container } = render(<Prueba />);
    expect(container.querySelector('.ag-grilla')).not.toBeNull();
    expect(container.querySelectorAll('.ag-grilla').length).toBe(1);
  });

  it('define las medidas del roadmap: barra 40, tablero 96, cola 320, detalle 380, rail 40', () => {
    expect(css).toMatch(/--grilla-barra:\s*var\(--space-10\)/);
    expect(css).toMatch(/--grilla-tablero:\s*96px/);
    expect(css).toMatch(/--grilla-cola:\s*320px/);
    expect(css).toMatch(/--grilla-detalle:\s*380px/);
    expect(css).toMatch(/--grilla-rail:\s*var\(--space-10\)/);
    expect(css).toMatch(/@media \(max-width: 1279px\)/);
  });

  it('por debajo de 1280 px el detalle es un drawer con altura entre la barra y el tablero', () => {
    const media = css.slice(css.indexOf('@media (max-width: 1279px)'));
    expect(media).toMatch(
      /\.ag-grilla__detalle \{[^}]*position: absolute;[^}]*height: auto;[^}]*top: var\(--grilla-barra\);[^}]*bottom: var\(--grilla-tablero\);/,
    );
  });

  it('colapsar B con su botón cambia data-colapsado y deja el rail', async () => {
    const { container } = render(<Prueba />);
    const rail = container.querySelector('.ag-grilla__cola');
    expect(rail?.getAttribute('data-colapsado')).toBe('false');
    await userEvent.click(screen.getByRole('button', { name: 'Colapsar Cola de incidentes' }));
    expect(rail?.getAttribute('data-colapsado')).toBe('true');
    expect(container.querySelector('.ag-grilla')?.getAttribute('data-cola')).toBe('colapsada');
    expect(screen.getByRole('button', { name: /Expandir Cola de incidentes/ }).getAttribute('aria-expanded')).toBe('false');
  });

  it('las teclas [ y ] colapsan y expanden B y D de forma independiente', () => {
    const { container } = render(<Prueba />);
    const cola = container.querySelector('.ag-grilla__cola');
    const detalle = container.querySelector('.ag-grilla__detalle');
    const grilla = container.querySelector('.ag-grilla');

    fireEvent.keyDown(document.body, { key: '[' });
    expect(cola?.getAttribute('data-colapsado')).toBe('true');
    expect(detalle?.getAttribute('data-colapsado')).toBe('false');

    fireEvent.keyDown(document.body, { key: ']' });
    expect(detalle?.getAttribute('data-colapsado')).toBe('true');
    expect(grilla?.getAttribute('data-detalle')).toBe('colapsado');

    fireEvent.keyDown(document.body, { key: '[' });
    fireEvent.keyDown(document.body, { key: ']' });
    expect(cola?.getAttribute('data-colapsado')).toBe('false');
    expect(detalle?.getAttribute('data-colapsado')).toBe('false');
    expect(grilla?.getAttribute('data-cola')).toBe('expandida');
  });

  it('no usa colores sueltos en su hoja de estilos', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
