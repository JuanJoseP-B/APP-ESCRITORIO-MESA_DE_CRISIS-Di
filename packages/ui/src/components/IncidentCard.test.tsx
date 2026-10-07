// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IncidentCard } from './IncidentCard';

afterEach(cleanup);

describe('IncidentCard', () => {
  it('muestra título, hora, severidad, estado y metadatos', () => {
    render(<IncidentCard title="Incendio forestal" severity="critico" status="abierto" time="14:02" code="INC-0412" reports={1} units={3} />);
    expect(screen.getByRole('heading', { name: 'Incendio forestal' })).toBeTruthy();
    expect(screen.getByText('14:02')).toBeTruthy();
    expect(screen.getByText('Crítico')).toBeTruthy();
    expect(screen.getByText('Abierto')).toBeTruthy();
    expect(screen.getByText('INC-0412')).toBeTruthy();
    expect(screen.getByText('1 reporte')).toBeTruthy();
    expect(screen.getByText('3 unidades')).toBeTruthy();
  });

  it('es un botón con aria-pressed según la selección y dispara onSelect', async () => {
    const onSelect = vi.fn();
    const { rerender } = render(<IncidentCard title="Inundación" severity="medio" onSelect={onSelect} />);
    const b = screen.getByRole('button');
    expect(b.getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(b);
    expect(onSelect).toHaveBeenCalledTimes(1);
    rerender(<IncidentCard title="Inundación" severity="medio" selected />);
    expect(screen.getByRole('button').getAttribute('aria-pressed')).toBe('true');
  });
});
