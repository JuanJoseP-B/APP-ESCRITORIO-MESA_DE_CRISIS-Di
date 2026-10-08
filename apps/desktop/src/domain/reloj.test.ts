import { describe, expect, it } from 'vitest';
import { calcularDesfaseMs, etiquetaZonaHoraria, formatearHoraConSegundos, formatearMinSeg } from './reloj';

describe('calcularDesfaseMs', () => {
  it('compara la hora del servidor con el punto medio del viaje', () => {
    // El cliente envía en t=1000 y recibe en t=1400: el servidor respondió hacia t=1200.
    expect(calcularDesfaseMs(5200, 1000, 1400)).toBe(4000);
  });

  it('es negativo si el servidor va atrasado y 0 si coinciden', () => {
    expect(calcularDesfaseMs(800, 1000, 1400)).toBe(-400);
    expect(calcularDesfaseMs(1200, 1000, 1400)).toBe(0);
  });
});

describe('formatearHoraConSegundos', () => {
  it('muestra HH:mm:ss en 24 h en la zona pedida', () => {
    const ms = Date.UTC(2026, 9, 7, 22, 15, 7);
    expect(formatearHoraConSegundos(ms, 'UTC')).toBe('22:15:07');
    expect(formatearHoraConSegundos(ms, 'America/Bogota')).toBe('17:15:07');
  });

  it('usa dos dígitos y no pasa a 24:00', () => {
    expect(formatearHoraConSegundos(Date.UTC(2026, 9, 8, 0, 5, 9), 'UTC')).toBe('00:05:09');
  });
});

describe('etiquetaZonaHoraria', () => {
  const ms = Date.UTC(2026, 9, 7, 22, 15, 7);

  it('muestra el desfase respecto a UTC', () => {
    expect(etiquetaZonaHoraria(ms, 'America/Bogota')).toBe('UTC-5');
    expect(etiquetaZonaHoraria(ms, 'Asia/Kolkata')).toBe('UTC+5:30');
  });

  it('en UTC no lleva desfase', () => {
    expect(etiquetaZonaHoraria(ms, 'UTC')).toBe('UTC');
  });
});

describe('formatearMinSeg', () => {
  it('da minutos y segundos con dos dígitos', () => {
    expect(formatearMinSeg(0)).toBe('00:00');
    expect(formatearMinSeg(65.9)).toBe('01:05');
    expect(formatearMinSeg(480)).toBe('08:00');
  });

  it('lo negativo cuenta como cero', () => {
    expect(formatearMinSeg(-3)).toBe('00:00');
  });
});
