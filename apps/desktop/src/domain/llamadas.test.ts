import { describe, expect, it } from 'vitest';
import type { Llamada } from '@argos/shared';
import {
  BORRADOR_VACIO,
  aNuevaLlamada,
  borradorDesdeLlamada,
  esCanal,
  incidenteDesdeLlamada,
  leerCoordenada,
  primerCampoVacio,
  tituloDeLlamada,
  ubicacionDe,
  validarBorrador,
  type Borrador,
} from './llamadas';

const LLAMADA: Llamada = {
  id: 'l1',
  canal: 'VHF',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: { lat: 1.2233, lng: -77.2859 },
  narrativa: 'Olor a gas en la cuadra.',
  reportante: 'Patrulla P01',
  callback: null,
  incidenteId: null,
  estadoValidacion: 'No confirmado',
  operadorId: null,
  creadoEn: '2026-10-08T12:00:00.000Z',
};

const COMPLETO: Borrador = {
  canal: '123',
  tipo: 'INCENDIO',
  prioridad: 'P2',
  reportante: '',
  callback: '',
  lat: '1.2136',
  lng: '-77.2811',
  narrativa: '',
};

describe('borradorDesdeLlamada', () => {
  it('precarga todos los campos de la llamada entrante', () => {
    expect(borradorDesdeLlamada(LLAMADA)).toEqual({
      canal: 'VHF',
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      reportante: 'Patrulla P01',
      callback: '',
      lat: '1.22330',
      lng: '-77.28590',
      narrativa: 'Olor a gas en la cuadra.',
    });
  });
});

describe('primerCampoVacio', () => {
  it('en el formulario vacío es el canal', () => {
    expect(primerCampoVacio(BORRADOR_VACIO)).toBe('canal');
  });

  it('recorre los campos en el orden del formulario', () => {
    expect(primerCampoVacio({ ...BORRADOR_VACIO, canal: '123' })).toBe('tipo');
    expect(primerCampoVacio({ ...COMPLETO })).toBe('reportante');
    expect(primerCampoVacio({ ...COMPLETO, reportante: 'Ana', callback: '300' })).toBe('narrativa');
  });

  it('un campo con solo espacios cuenta como vacío y, si están todos, no hay ninguno', () => {
    expect(primerCampoVacio({ ...COMPLETO, reportante: '   ', callback: 'x', narrativa: 'x' })).toBe('reportante');
    expect(primerCampoVacio({ ...COMPLETO, reportante: 'a', callback: 'b', narrativa: 'c' })).toBeNull();
  });

  it('una llamada entrante sin reportante deja el foco en el reportante', () => {
    expect(primerCampoVacio(borradorDesdeLlamada({ ...LLAMADA, reportante: null }))).toBe('reportante');
  });
});

describe('coordenadas', () => {
  it('acepta coma decimal y rechaza texto, vacío y valores fuera de rango', () => {
    expect(leerCoordenada('1,5', 90)).toBe(1.5);
    expect(leerCoordenada(' -77.28 ', 180)).toBe(-77.28);
    expect(leerCoordenada('', 90)).toBeNull();
    expect(leerCoordenada('abc', 90)).toBeNull();
    expect(leerCoordenada('91', 90)).toBeNull();
    expect(leerCoordenada('0', 90)).toBe(0);
  });

  it('la ubicación exige las dos coordenadas válidas', () => {
    expect(ubicacionDe({ lat: '1.2', lng: '-77.3' })).toEqual({ lat: 1.2, lng: -77.3 });
    expect(ubicacionDe({ lat: '1.2', lng: '' })).toBeNull();
    expect(ubicacionDe({ lat: '95', lng: '-77.3' })).toBeNull();
  });
});

describe('validarBorrador', () => {
  it('el formulario vacío pide canal, tipo, prioridad y ubicación', () => {
    expect(Object.keys(validarBorrador(BORRADOR_VACIO))).toEqual(['canal', 'tipo', 'prioridad', 'lat', 'lng']);
  });

  it('un borrador completo no tiene errores (reportante, callback y narrativa son opcionales)', () => {
    expect(validarBorrador(COMPLETO)).toEqual({});
  });

  it('señala la coordenada fuera de rango', () => {
    expect(Object.keys(validarBorrador({ ...COMPLETO, lng: '200' }))).toEqual(['lng']);
  });
});

describe('aNuevaLlamada', () => {
  it('devuelve null mientras haya errores', () => {
    expect(aNuevaLlamada(BORRADOR_VACIO)).toBeNull();
    expect(aNuevaLlamada({ ...COMPLETO, tipo: '' })).toBeNull();
  });

  it('recorta el texto y deja en null lo opcional vacío', () => {
    expect(aNuevaLlamada({ ...COMPLETO, reportante: ' Ana ', callback: '  ', narrativa: ' Humo ' })).toEqual({
      canal: '123',
      tipo: 'INCENDIO',
      prioridad: 'P2',
      ubicacion: { lat: 1.2136, lng: -77.2811 },
      narrativa: 'Humo',
      reportante: 'Ana',
      callback: null,
    });
  });

  it('la llamada precargada vuelve a ser la misma al confirmar', () => {
    expect(aNuevaLlamada(borradorDesdeLlamada(LLAMADA))).toMatchObject({
      canal: 'VHF',
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      reportante: 'Patrulla P01',
      callback: null,
    });
  });
});

describe('esCanal', () => {
  it('reconoce solo los canales del catálogo', () => {
    expect(esCanal('SENSOR')).toBe(true);
    expect(esCanal('WHATSAPP')).toBe(false);
    expect(esCanal('')).toBe(false);
  });
});

describe('incidenteDesdeLlamada', () => {
  const nueva = aNuevaLlamada(borradorDesdeLlamada(LLAMADA));
  if (nueva === null) throw new Error('la llamada de prueba debe ser válida');
  const AHORA = new Date('2026-10-08T12:05:00.000Z');

  it('abre el incidente en el punto de la llamada con su tipo y prioridad', () => {
    const incidente = incidenteDesdeLlamada(nueva, AHORA, 'op@argos.test');
    expect(incidente).toMatchObject({
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      nivel_criticidad: 'Crítico',
      estado: 'Abierto',
      geometria: { type: 'Point', coordinates: [-77.2859, 1.2233] },
    });
  });

  it('deja la creación en la bitácora con la hora y el operador', () => {
    const [evento] = incidenteDesdeLlamada(nueva, AHORA, 'op@argos.test').timeline;
    expect(evento).toEqual({
      timestamp: '2026-10-08T12:05:00.000Z',
      descripcion: 'Incidente creado desde llamada VHF (P1)',
      autor: 'op@argos.test',
    });
  });

  it.each([
    ['P1', 'Crítico'],
    ['P2', 'Medio'],
    ['P3', 'Bajo'],
    ['P4', 'Bajo'],
  ] as const)('la prioridad %s da criticidad %s', (prioridad, criticidad) => {
    expect(incidenteDesdeLlamada({ ...nueva, prioridad }, AHORA).nivel_criticidad).toBe(criticidad);
  });
});

describe('tituloDeLlamada', () => {
  it('usa el tipo y recorta una narrativa larga', () => {
    expect(tituloDeLlamada({ tipo: 'INCENDIO', narrativa: '' })).toBe('Incendio');
    expect(tituloDeLlamada({ tipo: 'INCENDIO', narrativa: 'Humo\n  visible' })).toBe('Incendio · Humo visible');
    const largo = tituloDeLlamada({ tipo: 'INCENDIO', narrativa: 'x'.repeat(100) });
    expect(largo.endsWith('…')).toBe(true);
    expect(largo.length).toBeLessThan(70);
  });
});
