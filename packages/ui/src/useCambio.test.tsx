// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Badge } from './components/Badge';
import { DispatchRow } from './components/DispatchRow';
import { UnitChip } from './components/UnitChip';
import unitCss from './components/UnitChip.css?raw';

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  document.documentElement.removeAttribute('style');
});

const avanzar = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

describe('cambio de estado en los componentes', () => {
  it('UnitChip: al montar no se anima; al cambiar de estado marca el cambio durante --dur-base', () => {
    const { rerender } = render(<UnitChip callsign="M11" status="disponible" />);
    const chip = () => screen.getByRole('group');
    expect(chip().className).not.toContain('ag-unit--cambio');
    rerender(<UnitChip callsign="M11" status="enruta" />);
    expect(chip().className).toContain('ag-unit--cambio');
    avanzar(240);
    expect(chip().className).not.toContain('ag-unit--cambio');
  });

  it('UnitChip: el cambio es un fundido con desplazamiento, sin giros', () => {
    expect(unitCss).toContain('ag-unit-cambio');
    expect(unitCss).not.toMatch(/rotate|perspective/);
  });

  it('UnitChip: con reduceMotion o con los tokens a 0 no hay animación', () => {
    const { rerender } = render(<UnitChip callsign="M11" status="disponible" reduceMotion />);
    rerender(<UnitChip callsign="M11" status="enruta" reduceMotion />);
    expect(screen.getByRole('group').className).not.toContain('ag-unit--cambio');

    document.documentElement.style.setProperty('--dur-base', '0ms');
    rerender(<UnitChip callsign="M11" status="escena" />);
    expect(screen.getByRole('group').className).not.toContain('ag-unit--cambio');
  });

  it('Badge: un valor nuevo da media vuelta; el mismo valor no', () => {
    const { container, rerender } = render(<Badge status="abierto" />);
    const badge = () => container.querySelector('.ag-badge');
    rerender(<Badge status="abierto" />);
    expect(badge()?.hasAttribute('data-cambio')).toBe(false);
    rerender(<Badge status="contenido" />);
    expect(badge()?.hasAttribute('data-cambio')).toBe(true);
    avanzar(400);
    expect(badge()?.hasAttribute('data-cambio')).toBe(false);
  });

  it('DispatchRow: la fila y su indicador marcan el cambio de estado', () => {
    const { rerender } = render(<DispatchRow kind="Ambulancia" code="M11" status="despachado" />);
    rerender(<DispatchRow kind="Ambulancia" code="M11" status="enruta" />);
    const fila = screen.getByRole('group', { name: 'Ambulancia M11' });
    expect(fila.hasAttribute('data-cambio')).toBe(true);
    expect(fila.querySelector('.ag-status')?.hasAttribute('data-cambio')).toBe(true);
    avanzar(400);
    expect(fila.hasAttribute('data-cambio')).toBe(false);
  });
});
