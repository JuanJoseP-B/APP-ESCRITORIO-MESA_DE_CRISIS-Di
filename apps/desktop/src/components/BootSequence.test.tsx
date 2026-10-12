// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootSequence } from './BootSequence';
import { DURACION_ARRANQUE_ESTATICA_MS, DURACION_ARRANQUE_MS, TIC_ARRANQUE_MS, type SubsistemasArranque } from '../domain/arranque';

const TODO_BIEN: SubsistemasArranque = {
  enlace: 'EN_VIVO',
  unidades: { cargando: false, error: null, disponibles: 4, total: 6 },
  refugios: { cargando: false, error: null, activos: 3 },
  mapa: 'LISTO',
};

const faseDe = (rotulo: RegExp) => screen.getByText(rotulo).closest('li')?.dataset['fase'];
const lineaDe = (rotulo: RegExp) => screen.getByText(rotulo).closest('li')?.textContent ?? '';
const avanzar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BootSequence: saltar', () => {
  it.each([
    ['Escape', () => fireEvent.keyDown(document, { key: 'Escape' })],
    ['Enter', () => fireEvent.keyDown(document, { key: 'Enter' })],
    ['un clic', () => fireEvent.click(screen.getByRole('dialog', { name: 'Iniciando ARGOS' }))],
  ])('%s la salta de inmediato y el temporizador ya no vuelve a completarla', (_, saltar) => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    saltar();
    expect(alCompletar).toHaveBeenCalledTimes(1);
    avanzar(DURACION_ARRANQUE_MS);
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });

  it('otras teclas no la saltan', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    fireEvent.keyDown(document, { key: 'j' });
    expect(alCompletar).not.toHaveBeenCalled();
  });
});

describe('BootSequence: secuencia', () => {
  it('las líneas aparecen una a una, primero comprobando y luego con su resultado real', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    expect(faseDe(/Núcleo táctico/)).toBe('comprobando');
    expect(faseDe(/Enlace CMGRD Pasto/)).toBe('oculta');

    avanzar(TIC_ARRANQUE_MS);
    expect(faseDe(/Núcleo táctico/)).toBe('resuelta');
    avanzar(TIC_ARRANQUE_MS);
    expect(faseDe(/Enlace CMGRD Pasto/)).toBe('comprobando');

    avanzar(DURACION_ARRANQUE_MS - TIC_ARRANQUE_MS * 2 - 1);
    expect(lineaDe(/Unidades operativas/)).toContain('✓ 4/6 disponibles');
    expect(lineaDe(/Red de refugios/)).toContain('✓ 3 activos');
    expect(faseDe(/Cartografía táctica/)).toBe('resuelta');
    expect(alCompletar).not.toHaveBeenCalled();
    avanzar(1);
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });

  it('un subsistema que falla lo dice en su línea, sin ✓', () => {
    render(
      <BootSequence
        subsistemas={{ ...TODO_BIEN, enlace: 'SIN_ENLACE', unidades: { cargando: false, error: 'red caída', disponibles: 0, total: 0 }, mapa: 'ERROR' }}
        reducirMovimiento
        onCompletar={vi.fn()}
      />,
    );
    expect(lineaDe(/Enlace CMGRD Pasto/)).toContain('Sin enlace');
    expect(lineaDe(/Unidades operativas/)).toContain('Sin datos de unidades');
    expect(lineaDe(/Cartografía táctica/)).toContain('No cargó');
    for (const rotulo of [/Enlace CMGRD Pasto/, /Unidades operativas/, /Cartografía táctica/]) expect(lineaDe(rotulo)).not.toContain('✓');
    expect(lineaDe(/Red de refugios/)).toContain('✓');
  });

  it('lo que aún carga se muestra como pendiente y cambia a ✓ cuando llega el dato', () => {
    const pendiente: SubsistemasArranque = { ...TODO_BIEN, mapa: 'CARGANDO' };
    const { rerender } = render(<BootSequence subsistemas={pendiente} reducirMovimiento onCompletar={vi.fn()} />);
    expect(lineaDe(/Cartografía táctica/)).toContain('Cargando');
    expect(lineaDe(/Cartografía táctica/)).not.toContain('✓');
    rerender(<BootSequence subsistemas={TODO_BIEN} reducirMovimiento onCompletar={vi.fn()} />);
    expect(lineaDe(/Cartografía táctica/)).toContain('✓ Listo');
  });

  it('con movimiento reducido sale completa y estática, y se cierra a los 600 ms', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} reducirMovimiento onCompletar={alCompletar} />);
    expect(screen.getAllByRole('listitem').map((li) => li.dataset['fase'])).toEqual(Array(5).fill('resuelta'));
    avanzar(DURACION_ARRANQUE_ESTATICA_MS - 1);
    expect(alCompletar).not.toHaveBeenCalled();
    avanzar(1);
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });
});
