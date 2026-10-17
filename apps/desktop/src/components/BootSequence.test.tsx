// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BootSequence } from './BootSequence';
import { TICS_ARRANQUE, TIC_ARRANQUE_MS, type SubsistemasArranque } from '../domain/arranque';

const TODO_BIEN: SubsistemasArranque = {
  enlace: 'EN_VIVO',
  unidades: { cargando: false, error: null, disponibles: 4, total: 6 },
  refugios: { cargando: false, error: null, activos: 3 },
  mapa: 'LISTO',
};

/** Tiempo hasta que la última línea muestra su resultado. */
const HASTA_COMPLETAR_MS = (TICS_ARRANQUE - 1) * TIC_ARRANQUE_MS;

const faseDe = (rotulo: RegExp) => screen.getByText(rotulo).closest('li')?.dataset['fase'];
const lineaDe = (rotulo: RegExp) => screen.getByText(rotulo).closest('li')?.textContent ?? '';
const avanzar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));
const entrar = () => screen.queryByRole('button', { name: /Entrar a la consola/ });
const pulsar = (key: string) => fireEvent.keyDown(document.activeElement ?? document.body, { key });

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('BootSequence: secuencia', () => {
  it('las líneas aparecen una cada 350 ms, primero comprobando y luego con su resultado real', () => {
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={vi.fn()} />);
    expect(faseDe(/Núcleo táctico/)).toBe('comprobando');
    expect(faseDe(/Enlace CMGRD Pasto/)).toBe('oculta');

    avanzar(TIC_ARRANQUE_MS);
    expect(faseDe(/Núcleo táctico/)).toBe('resuelta');
    expect(faseDe(/Enlace CMGRD Pasto/)).toBe('oculta');
    avanzar(TIC_ARRANQUE_MS);
    expect(faseDe(/Enlace CMGRD Pasto/)).toBe('comprobando');
    avanzar(350);
    expect(faseDe(/Unidades operativas/)).toBe('comprobando');

    avanzar(HASTA_COMPLETAR_MS);
    expect(lineaDe(/Unidades operativas/)).toContain('✓ 4/6 disponibles');
    expect(lineaDe(/Red de refugios/)).toContain('✓ 3 activos');
    expect(faseDe(/Cartografía táctica/)).toBe('resuelta');
  });

  it('no se cierra sola: al completarse ofrece ENTRAR A LA CONSOLA con el foco puesto', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    expect(entrar()).toBeNull();
    avanzar(HASTA_COMPLETAR_MS - 1);
    expect(entrar()).toBeNull();
    avanzar(1);
    expect(entrar()).toBeTruthy();
    expect(document.activeElement).toBe(entrar());
    expect(entrar()?.textContent).toContain('Enter');

    avanzar(60_000);
    expect(alCompletar).not.toHaveBeenCalled();
  });
});

describe('BootSequence: entrar y saltar', () => {
  it('Enter antes de completarse no hace nada ni llega a la consola de debajo', () => {
    const alCompletar = vi.fn();
    const debajo = vi.fn();
    document.addEventListener('keydown', debajo);
    try {
      render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
      pulsar('Enter');
      expect(alCompletar).not.toHaveBeenCalled();
      expect(debajo).not.toHaveBeenCalled();
    } finally {
      document.removeEventListener('keydown', debajo);
    }
  });

  it('Enter con el botón a la vista entra una sola vez', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    avanzar(HASTA_COMPLETAR_MS);
    pulsar('Enter');
    pulsar('Enter');
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });

  it('el clic en ENTRAR A LA CONSOLA entra', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    avanzar(HASTA_COMPLETAR_MS);
    fireEvent.click(entrar() as HTMLElement);
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['Esc', () => pulsar('Escape')],
    ['«Saltar»', () => fireEvent.click(screen.getByRole('button', { name: 'Saltar' }))],
  ])('%s la cierra en cualquier momento, antes de completarse', (_, saltar) => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    saltar();
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });

  it('un clic fuera de los botones no hace nada', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} onCompletar={alCompletar} />);
    avanzar(HASTA_COMPLETAR_MS);
    fireEvent.click(screen.getByRole('dialog', { name: 'Iniciando ARGOS' }));
    fireEvent.click(screen.getByText(/Núcleo táctico/));
    expect(alCompletar).not.toHaveBeenCalled();
  });
});

describe('BootSequence: estado real y movimiento reducido', () => {
  it('un subsistema que falla lo dice en su línea, sin ✓, y el botón sigue disponible', () => {
    const alCompletar = vi.fn();
    render(
      <BootSequence
        subsistemas={{ ...TODO_BIEN, enlace: 'SIN_ENLACE', unidades: { cargando: false, error: 'red caída', disponibles: 0, total: 0 }, mapa: 'ERROR' }}
        onCompletar={alCompletar}
      />,
    );
    avanzar(HASTA_COMPLETAR_MS);
    expect(lineaDe(/Enlace CMGRD Pasto/)).toContain('Sin enlace');
    expect(lineaDe(/Unidades operativas/)).toContain('Sin datos de unidades');
    expect(lineaDe(/Cartografía táctica/)).toContain('No cargó');
    for (const rotulo of [/Enlace CMGRD Pasto/, /Unidades operativas/, /Cartografía táctica/]) expect(lineaDe(rotulo)).not.toContain('✓');
    expect(lineaDe(/Red de refugios/)).toContain('✓');

    pulsar('Enter');
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });

  it('lo que aún carga se muestra como pendiente y cambia a ✓ cuando llega el dato', () => {
    const pendiente: SubsistemasArranque = { ...TODO_BIEN, mapa: 'CARGANDO' };
    const { rerender } = render(<BootSequence subsistemas={pendiente} reducirMovimiento onCompletar={vi.fn()} />);
    expect(lineaDe(/Cartografía táctica/)).toContain('Cargando');
    expect(lineaDe(/Cartografía táctica/)).not.toContain('✓');
    rerender(<BootSequence subsistemas={TODO_BIEN} reducirMovimiento onCompletar={vi.fn()} />);
    expect(lineaDe(/Cartografía táctica/)).toContain('✓ Listo');
  });

  it('con movimiento reducido sale completa con el botón desde el principio y tampoco se cierra sola', () => {
    const alCompletar = vi.fn();
    render(<BootSequence subsistemas={TODO_BIEN} reducirMovimiento onCompletar={alCompletar} />);
    expect(screen.getAllByRole('listitem').map((li) => li.dataset['fase'])).toEqual(Array(5).fill('resuelta'));
    expect(document.activeElement).toBe(entrar());
    avanzar(60_000);
    expect(alCompletar).not.toHaveBeenCalled();
    pulsar('Enter');
    expect(alCompletar).toHaveBeenCalledTimes(1);
  });
});
