// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShelterGauge } from './ShelterGauge';

afterEach(cleanup);

describe('ShelterGauge', () => {
  it('formatea el aforo con ceros y expone un meter accesible', () => {
    render(<ShelterGauge name="Coliseo" current={45} capacity={200} />);
    expect(screen.getByText('045/200')).toBeTruthy();
    expect(screen.getByText('23%')).toBeTruthy();
    expect(screen.getByText('155 cupos')).toBeTruthy();
    const meter = screen.getByRole('meter', { name: 'Aforo Coliseo' });
    expect(meter.getAttribute('aria-valuenow')).toBe('45');
    expect(meter.getAttribute('aria-valuemax')).toBe('200');
  });

  it.each([
    [100, 'Con cupo', 'circle'],
    [150, 'Alta ocupación', 'triangle'],
    [185, 'Casi lleno', 'square'],
    [200, 'Lleno', 'square'],
  ] as const)('con %i de 200 muestra "%s" con glifo %s', (current, palabra, forma) => {
    const { container } = render(<ShelterGauge name="Coliseo" current={current} capacity={200} />);
    expect(screen.getByText(palabra)).toBeTruthy();
    expect(container.querySelector(`.ag-gauge__state .ag-glyph--${forma}`)).not.toBeNull();
  });

  it('suma y resta por el paso y se deshabilita en los extremos', async () => {
    const onIncrement = vi.fn();
    const onDecrement = vi.fn();
    const { rerender } = render(<ShelterGauge name="X" current={10} capacity={20} step={5} onIncrement={onIncrement} onDecrement={onDecrement} />);
    await userEvent.click(screen.getByRole('button', { name: 'Sumar 5' }));
    await userEvent.click(screen.getByRole('button', { name: 'Restar 5' }));
    expect(onIncrement).toHaveBeenCalledTimes(1);
    expect(onDecrement).toHaveBeenCalledTimes(1);
    rerender(<ShelterGauge name="X" current={20} capacity={20} />);
    expect((screen.getByRole('button', { name: 'Sumar 5' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<ShelterGauge name="X" current={0} capacity={20} />);
    expect((screen.getByRole('button', { name: 'Restar 5' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
