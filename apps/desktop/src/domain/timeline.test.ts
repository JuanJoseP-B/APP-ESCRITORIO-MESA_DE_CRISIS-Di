import { describe, expect, it } from 'vitest';
import { eventosVisibles, formatearHora } from './timeline';

describe('formatearHora', () => {
  it('formatea una fecha ISO en 24 h', () => {
    expect(formatearHora('2026-10-04T20:48:40.712Z', 'UTC')).toBe('20:48');
    expect(formatearHora('2026-10-04T00:05:00Z', 'UTC')).toBe('00:05');
    expect(formatearHora('2026-10-04T20:48:00Z', 'America/Bogota')).toBe('15:48');
  });

  it.each([undefined, null, '', 'x', '14:02', 42, {}])('nunca devuelve "Invalid Date" (%j)', (valor) => {
    expect(formatearHora(valor, 'UTC')).toBe('--:--');
  });
});

describe('eventosVisibles', () => {
  it('conserva los eventos con el contrato {timestamp, descripcion}', () => {
    expect(eventosVisibles([{ timestamp: '2026-01-01T10:30:00Z', descripcion: 'Reporte inicial' }], 'UTC')).toEqual([
      { hora: '10:30', iso: '2026-01-01T10:30:00Z', descripcion: 'Reporte inicial' },
    ]);
  });

  it('tolera las filas antiguas {hora, evento}', () => {
    expect(eventosVisibles([{ hora: '14:02', evento: 'Llamada registrada' }, { hora: '9:05', evento: 'x' }])).toEqual([
      { hora: '14:02', iso: null, descripcion: 'Llamada registrada' },
      { hora: '09:05', iso: null, descripcion: 'x' },
    ]);
  });

  it('no rompe con datos incompletos o que no son una lista', () => {
    expect(eventosVisibles([{ hora: 'ayer' }, null, 'texto'])).toEqual([
      { hora: '--:--', iso: null, descripcion: 'Evento sin descripción' },
    ]);
    expect(eventosVisibles(null)).toEqual([]);
    expect(eventosVisibles(undefined)).toEqual([]);
  });
});
