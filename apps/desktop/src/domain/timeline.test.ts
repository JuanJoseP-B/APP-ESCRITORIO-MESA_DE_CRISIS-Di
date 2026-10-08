import { describe, expect, it } from 'vitest';
import { bitacora, eventosVisibles, formatearHora, type EntradaBitacora } from './timeline';

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
      { hora: '10:30', iso: '2026-01-01T10:30:00Z', descripcion: 'Reporte inicial', autor: null },
    ]);
  });

  it('incluye el autor del evento cuando existe', () => {
    const [evento] = eventosVisibles(
      [{ timestamp: '2026-01-01T10:30:00Z', descripcion: 'Estado cambiado a Contenido', autor: 'operador@argos.test' }],
      'UTC',
    );
    expect(evento?.autor).toBe('operador@argos.test');
  });

  it('tolera las filas antiguas {hora, evento}', () => {
    expect(eventosVisibles([{ hora: '14:02', evento: 'Llamada registrada' }, { hora: '9:05', evento: 'x' }])).toEqual([
      { hora: '09:05', iso: null, descripcion: 'x', autor: null },
      { hora: '14:02', iso: null, descripcion: 'Llamada registrada', autor: null },
    ]);
  });

  it('no rompe con datos incompletos o que no son una lista', () => {
    expect(eventosVisibles([{ hora: 'ayer' }, null, 'texto'])).toEqual([
      { hora: '--:--', iso: null, descripcion: 'Evento sin descripción', autor: null },
    ]);
    expect(eventosVisibles(null)).toEqual([]);
    expect(eventosVisibles(undefined)).toEqual([]);
  });

  it('ordena por timestamp: el caso de la captura (14:02 / 15:48 / 10:29) queda en orden', () => {
    const horas = (t: unknown) => eventosVisibles(t, 'UTC').map((e) => e.hora);
    // Con fecha, tal como lo guarda la aplicación.
    expect(
      horas([
        { timestamp: '2026-10-07T14:02:00Z', descripcion: 'a' },
        { timestamp: '2026-10-07T15:48:00Z', descripcion: 'b' },
        { timestamp: '2026-10-07T10:29:00Z', descripcion: 'c' },
      ]),
    ).toEqual(['10:29', '14:02', '15:48']);
    // Filas cargadas a mano, sin fecha: se ordenan por su hora.
    expect(horas([{ hora: '14:02', evento: 'a' }, { hora: '15:48', evento: 'b' }, { hora: '10:29', evento: 'c' }])).toEqual([
      '10:29',
      '14:02',
      '15:48',
    ]);
  });

  it('los eventos sin fecha van antes que los fechados y los empates conservan el orden', () => {
    const descripciones = eventosVisibles(
      [
        { timestamp: '2026-10-07T10:00:00Z', descripcion: 'fechado-1' },
        { hora: '09:00', evento: 'sin-fecha' },
        { timestamp: '2026-10-07T10:00:00Z', descripcion: 'fechado-2' },
      ],
      'UTC',
    ).map((e) => e.descripcion);
    expect(descripciones).toEqual(['sin-fecha', 'fechado-1', 'fechado-2']);
  });

  it('no muta el timeline recibido', () => {
    const timeline = [
      { timestamp: '2026-10-07T15:00:00Z', descripcion: 'b' },
      { timestamp: '2026-10-07T10:00:00Z', descripcion: 'a' },
    ];
    eventosVisibles(timeline, 'UTC');
    expect(timeline.map((e) => e.descripcion)).toEqual(['b', 'a']);
  });
});

describe('bitacora', () => {
  const tipos = (entradas: readonly EntradaBitacora[]) =>
    entradas.map((e) => (e.tipo === 'fecha' ? `fecha:${e.clave}` : `${e.hora} ${e.descripcion}`));

  it('ordena eventos de días distintos y pone un separador de fecha antes de cada día', () => {
    const entradas = bitacora(
      [
        { timestamp: '2026-10-08T00:10:00Z', descripcion: 'madrugada' },
        { timestamp: '2026-10-07T23:50:00Z', descripcion: 'noche' },
        { timestamp: '2026-10-07T08:00:00Z', descripcion: 'mañana' },
      ],
      'UTC',
    );
    expect(tipos(entradas)).toEqual([
      'fecha:2026-10-07',
      '08:00 mañana',
      '23:50 noche',
      'fecha:2026-10-08',
      '00:10 madrugada',
    ]);
  });

  it('el separador usa la zona mostrada: 23:30 UTC ya es el día siguiente en UTC+2', () => {
    const entradas = bitacora([{ timestamp: '2026-10-07T23:30:00Z', descripcion: 'x' }], 'Europe/Madrid');
    expect(entradas[0]).toMatchObject({ tipo: 'fecha', clave: '2026-10-08' });
  });

  it('la etiqueta del separador es legible', () => {
    const [separador] = bitacora([{ timestamp: '2026-10-07T12:00:00Z', descripcion: 'x' }], 'UTC');
    expect(separador).toMatchObject({ tipo: 'fecha', clave: '2026-10-07' });
    expect(separador?.tipo === 'fecha' && separador.etiqueta).toMatch(/^0?7 oct 2026$|^07 oct 2026$/);
  });

  it('un mismo día lleva un solo separador y cada evento conserva su autor', () => {
    const entradas = bitacora(
      [
        { timestamp: '2026-10-07T09:00:00Z', descripcion: 'a', autor: 'op1' },
        { timestamp: '2026-10-07T09:30:00Z', descripcion: 'b' },
      ],
      'UTC',
    );
    expect(entradas.filter((e) => e.tipo === 'fecha')).toHaveLength(1);
    expect(entradas.filter((e) => e.tipo === 'evento').map((e) => (e.tipo === 'evento' ? e.autor : 'x'))).toEqual(['op1', null]);
  });

  it('los eventos sin fecha no llevan separador y van primero', () => {
    const entradas = bitacora([{ timestamp: '2026-10-07T09:00:00Z', descripcion: 'fechado' }, { hora: '08:00', evento: 'viejo' }], 'UTC');
    expect(tipos(entradas)).toEqual(['08:00 viejo', 'fecha:2026-10-07', '09:00 fechado']);
  });

  it('sin timeline válido no hay entradas', () => {
    expect(bitacora(null)).toEqual([]);
    expect(bitacora([])).toEqual([]);
  });
});
