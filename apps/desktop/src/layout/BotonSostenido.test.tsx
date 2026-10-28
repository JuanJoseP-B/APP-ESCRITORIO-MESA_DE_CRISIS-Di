// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BotonSostenido, SOSTENER_MS } from './BotonSostenido';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const montar = () => {
  const confirmar = vi.fn();
  render(
    <BotonSostenido ariaLabel="Marcar Resuelto" onConfirmar={confirmar}>
      Mantener: resuelto
    </BotonSostenido>,
  );
  return { confirmar, boton: screen.getByRole('button', { name: 'Marcar Resuelto' }) };
};

describe('BotonSostenido', () => {
  it('confirma solo tras mantener pulsado 700 ms', () => {
    const { confirmar, boton } = montar();
    fireEvent.pointerDown(boton, { button: 0 });
    expect(boton.hasAttribute('data-cargando')).toBe(true);
    act(() => vi.advanceTimersByTime(SOSTENER_MS - 1));
    expect(confirmar).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(confirmar).toHaveBeenCalledTimes(1);
    expect(boton.hasAttribute('data-cargando')).toBe(false);
  });

  it('si se suelta antes de 700 ms se cancela y el relleno vuelve', () => {
    const { confirmar, boton } = montar();
    fireEvent.pointerDown(boton, { button: 0 });
    act(() => vi.advanceTimersByTime(SOSTENER_MS - 100));
    fireEvent.pointerUp(boton);
    expect(boton.hasAttribute('data-cargando')).toBe(false);
    act(() => vi.advanceTimersByTime(SOSTENER_MS));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('salir con el puntero también cancela', () => {
    const { confirmar, boton } = montar();
    fireEvent.pointerDown(boton, { button: 0 });
    fireEvent.pointerLeave(boton);
    act(() => vi.advanceTimersByTime(SOSTENER_MS));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it('un clic simple no confirma', () => {
    const { confirmar, boton } = montar();
    fireEvent.click(boton);
    act(() => vi.advanceTimersByTime(SOSTENER_MS));
    expect(confirmar).not.toHaveBeenCalled();
  });

  it.each([' ', 'Enter'])('con el teclado: mantener «%s» confirma y soltarlo antes cancela', (tecla) => {
    const { confirmar, boton } = montar();
    fireEvent.keyDown(boton, { key: tecla });
    act(() => vi.advanceTimersByTime(300));
    fireEvent.keyUp(boton, { key: tecla });
    act(() => vi.advanceTimersByTime(SOSTENER_MS));
    expect(confirmar).not.toHaveBeenCalled();
    fireEvent.keyDown(boton, { key: tecla });
    fireEvent.keyDown(boton, { key: tecla, repeat: true });
    act(() => vi.advanceTimersByTime(SOSTENER_MS));
    expect(confirmar).toHaveBeenCalledTimes(1);
  });

  it('explica cómo se usa a los lectores de pantalla', () => {
    const { boton } = montar();
    const ayuda = document.getElementById(boton.getAttribute('aria-describedby') ?? '');
    expect(ayuda?.textContent).toBe('Mantén pulsado para confirmar');
  });
});
