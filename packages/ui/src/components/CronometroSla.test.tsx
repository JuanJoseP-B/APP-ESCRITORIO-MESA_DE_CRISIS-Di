// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { CronometroSla } from './CronometroSla';
import css from './CronometroSla.css?raw';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** jsdom no trae `matchMedia`: simula que el sistema pide (o no) menos movimiento. */
function simularMovimientoReducido(reduce: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn((consulta: string) => ({
      matches: reduce && consulta.includes('prefers-reduced-motion'),
      media: consulta,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

describe('CronometroSla', () => {
  it('en tiempo muestra solo mm:ss, sin glifo ni palabra', () => {
    const { container } = render(<CronometroSla nivel="en_tiempo" tiempo="02:05" />);
    expect(container.querySelector('.ag-sla__tiempo')?.textContent).toBe('02:05');
    expect(container.querySelector('.ag-glyph')).toBeNull();
    expect(container.querySelector('.ag-sla__palabra')).toBeNull();
    expect(screen.getByRole('timer', { name: '02:05' })).toBeTruthy();
  });

  it('alerta = color ámbar + triángulo + palabra', () => {
    const { container } = render(<CronometroSla nivel="alerta" tiempo="08:10" />);
    expect(container.querySelector('.ag-sla')?.getAttribute('data-nivel')).toBe('alerta');
    expect(container.querySelector('.ag-glyph--triangle')).not.toBeNull();
    expect(container.querySelector('.ag-sla__palabra')?.textContent).toBe('alerta');
    expect(screen.getByRole('timer', { name: '08:10, alerta' })).toBeTruthy();
    expect(css).toMatch(/\[data-nivel="alerta"\][^}]*var\(--status-warning\)/);
  });

  it('vencido = color crítico + cuadrado + palabra, y las palabras se pueden traducir', () => {
    const { container } = render(<CronometroSla nivel="vencido" tiempo="10:01" palabras={{ alerta: 'warning', vencido: 'overdue' }} />);
    expect(container.querySelector('.ag-glyph--square')).not.toBeNull();
    expect(container.querySelector('.ag-sla__palabra')?.textContent).toBe('overdue');
    expect(screen.getByRole('timer', { name: '10:01, overdue' })).toBeTruthy();
    expect(css).toMatch(/\[data-nivel="vencido"\]\s*\{[^}]*var\(--status-critical\)/);
  });

  it('mostrarPalabra=false la deja solo para lectores de pantalla', () => {
    const { container } = render(<CronometroSla nivel="vencido" tiempo="10:01" mostrarPalabra={false} />);
    expect(container.querySelector('.ag-sla__palabra')).toBeNull();
    expect(screen.getByRole('timer', { name: '10:01, vencido' })).toBeTruthy();
  });

  it('VENCIDO aplica el parpadeo de 1 Hz', () => {
    simularMovimientoReducido(false);
    const { container } = render(<CronometroSla nivel="vencido" tiempo="10:01" />);
    expect(container.querySelector('.ag-sla')?.getAttribute('data-movimiento')).toBe('normal');
    expect(css).toMatch(/\[data-nivel="vencido"\]\[data-movimiento="normal"\]\s*\{[^}]*animation: ag-sla-parpadeo 1s/);
    expect(css).toContain('@keyframes ag-sla-parpadeo');
  });

  it('con prefers-reduced-motion usa el patrón estático en vez del parpadeo', () => {
    simularMovimientoReducido(true);
    const { container } = render(<CronometroSla nivel="vencido" tiempo="10:01" />);
    expect(container.querySelector('.ag-sla')?.getAttribute('data-movimiento')).toBe('reducido');
    const regla = css.match(/\[data-nivel="vencido"\]\[data-movimiento="reducido"\]\s*\{[^}]*\}/)?.[0] ?? '';
    expect(regla).toContain('animation: none');
    expect(regla).toContain('box-shadow: inset 0 0 0 3px');
    expect(regla).toContain('repeating-linear-gradient');
  });

  it('reducirMovimiento (Ajustes) tiene el mismo efecto sin depender del sistema', () => {
    simularMovimientoReducido(false);
    const { container } = render(<CronometroSla nivel="vencido" tiempo="10:01" reducirMovimiento />);
    expect(container.querySelector('.ag-sla')?.getAttribute('data-movimiento')).toBe('reducido');
  });

  it('ALERTA y EN_TIEMPO nunca parpadean ni llevan rayas', () => {
    expect(css).not.toMatch(/data-nivel="(alerta|en_tiempo)"\][^{]*\{[^}]*animation/);
  });

  it('también cubre prefers-reduced-motion y el ajuste del operador por CSS', () => {
    expect(css).toContain('@media (prefers-reduced-motion: reduce)');
    expect(css).toContain(":root[data-reduced-motion='true']");
  });

  it('no usa colores sueltos en su hoja de estilos', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
  });
});
