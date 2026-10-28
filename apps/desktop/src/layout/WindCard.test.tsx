// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { WindCard } from './WindCard';

afterEach(cleanup);

describe('WindCard', () => {
  it('muestra velocidad, rumbo y una recomendación derivada de hacia dónde sopla', () => {
    render(<WindCard viento={{ speedKmh: 14, fromDeg: 224 }} />);
    const tarjeta = screen.getByRole('region', { name: 'Viento en vivo' });
    expect(tarjeta.textContent).toContain('14 km/h');
    expect(tarjeta.textContent).toContain('SO → NE · 44°');
    expect(tarjeta.textContent).toContain('La nube se desplaza al NE. Evacuar ese sector primero.');
    expect(tarjeta.style.getPropertyValue('--ag-rumbo')).toBe('44deg');
  });

  it('se pliega a un botón circular con la flecha y se vuelve a desplegar', async () => {
    render(<WindCard viento={{ speedKmh: 9, fromDeg: 90 }} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plegar la tarjeta de viento' }));
    expect(screen.queryByRole('region', { name: 'Viento en vivo' })).toBeNull();
    const boton = screen.getByRole('button', { name: 'Viento 9 km/h, de E hacia O. Desplegar la tarjeta' });
    expect(boton.style.getPropertyValue('--ag-rumbo')).toBe('270deg');
    await userEvent.click(boton);
    expect(screen.getByRole('region', { name: 'Viento en vivo' })).toBeTruthy();
  });

  it('se pliega sola mientras se traza una zona', () => {
    const { rerender } = render(<WindCard viento={{ speedKmh: 9, fromDeg: 90 }} />);
    rerender(<WindCard viento={{ speedKmh: 9, fromDeg: 90 }} plegarForzado />);
    expect(screen.queryByRole('region', { name: 'Viento en vivo' })).toBeNull();
  });
});
