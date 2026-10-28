// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PALABRAS_CRONOMETRO } from '@argos/ui';
import { ANIMACION_DESPACHO_MS, UnitCard, type UnitCardProps } from './UnitCard';
import css from './TableroUnidades.css?raw';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const props = (extra: Partial<UnitCardProps> = {}): UnitCardProps => ({
  callsign: 'U01',
  tipo: 'Bomberos',
  kind: 'Bomberos',
  status: 'disponible',
  statusLabel: 'Disponible',
  statusShort: 'DISP',
  timerWords: PALABRAS_CRONOMETRO,
  onSelect: vi.fn(),
  ...extra,
});

describe('UnitCard', () => {
  it('en reposo no anima nada: las animaciones de tipo solo se declaran para hover o data-animando', () => {
    render(<UnitCard {...props()} />);
    expect(screen.getByRole('button', { name: /^U01/ }).hasAttribute('data-animando')).toBe(false);
    // Cada regla con animation-name de tipo exige :hover o [data-animando].
    const reglas = css.split('}').filter((r) => /animation: ag-(llama|chispa|ecg|latido-cruz|sirena)/.test(r));
    expect(reglas.length).toBeGreaterThan(0);
    for (const regla of reglas) expect(regla).toMatch(/:hover|\[data-animando\]/);
  });

  it('al despacharla (pasa a despachada o en ruta) anima su tipo un momento y el chip gira', () => {
    const { rerender } = render(<UnitCard {...props()} />);
    rerender(<UnitCard {...props({ status: 'enruta', statusLabel: 'En ruta', statusShort: 'RUTA', detalle: '02:40', progreso: 0.3 })} />);
    const tarjeta = screen.getByRole('button', { name: /^U01/ });
    expect(tarjeta.hasAttribute('data-animando')).toBe(true);
    expect(tarjeta.querySelector('.ag-unidad__chip')?.hasAttribute('data-cambio')).toBe(true);
    expect(tarjeta.querySelector('.ag-unidad__chip')?.textContent).toBe('RUTA02:40');
    expect((tarjeta.querySelector('.ag-unidad__eta') as HTMLElement | null)?.style.width).toBe('30%');
    act(() => vi.advanceTimersByTime(ANIMACION_DESPACHO_MS));
    expect(tarjeta.hasAttribute('data-animando')).toBe(false);
  });

  it('con movimiento reducido no se anima al cambiar de estado', () => {
    const { rerender } = render(<UnitCard {...props({ reduceMotion: true })} />);
    rerender(<UnitCard {...props({ reduceMotion: true, status: 'despachado', statusShort: 'ASIG' })} />);
    expect(screen.getByRole('button', { name: /^U01/ }).hasAttribute('data-animando')).toBe(false);
  });

  it('una unidad libre muestra la distancia al incidente; el cursor la resalta en el mapa', () => {
    const resaltar = vi.fn();
    render(<UnitCard {...props({ detalle: '0,9 km', onResaltar: resaltar })} />);
    const tarjeta = screen.getByRole('button', { name: /^U01/ });
    expect(tarjeta.querySelector('.ag-unidad__chip')?.textContent).toBe('DISP· 0,9 km');
    fireEvent.mouseEnter(tarjeta);
    expect(resaltar).toHaveBeenLastCalledWith(true);
    fireEvent.mouseLeave(tarjeta);
    expect(resaltar).toHaveBeenLastCalledWith(false);
  });

  it('cada tipo lleva su icono y sus piezas de animación', () => {
    const { container, rerender } = render(<UnitCard {...props()} />);
    expect(container.querySelectorAll('.ag-unidad__chispa')).toHaveLength(2);
    rerender(<UnitCard {...props({ tipo: 'Ambulancia', kind: 'Ambulancia' })} />);
    expect(container.querySelector('.ag-unidad--salud .ag-unidad__ecg path')?.getAttribute('pathLength')).toBe('1');
    rerender(<UnitCard {...props({ tipo: 'Policía', kind: 'Policía' })} />);
    expect(container.querySelector('.ag-unidad--policia .ag-unidad__sirena')).not.toBeNull();
  });
});
