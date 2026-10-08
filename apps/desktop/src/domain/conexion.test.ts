import { describe, expect, it } from 'vitest';
import { estadoEnlace } from './conexion';

const ok = { cargando: false, error: null };

describe('estadoEnlace', () => {
  it('EN_VIVO si todas las listas cargaron sin error (y sin listas)', () => {
    expect(estadoEnlace([ok, ok])).toBe('EN_VIVO');
    expect(estadoEnlace([])).toBe('EN_VIVO');
  });

  it('CONECTANDO mientras alguna lista carga', () => {
    expect(estadoEnlace([ok, { cargando: true, error: null }])).toBe('CONECTANDO');
  });

  it('SIN_ENLACE si alguna falló, aunque otra siga cargando', () => {
    expect(estadoEnlace([ok, { cargando: false, error: 'No se pudo leer incidentes' }])).toBe('SIN_ENLACE');
    expect(estadoEnlace([{ cargando: true, error: null }, { cargando: false, error: 'x' }])).toBe('SIN_ENLACE');
  });
});
