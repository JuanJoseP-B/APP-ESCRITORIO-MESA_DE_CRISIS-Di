import { describe, expect, it } from 'vitest';
import { PRIORIDAD_POR_CRITICIDAD, type EstadoIncidente, type Incidente, type NivelCriticidad, type Recurso } from '@argos/shared';
import {
  aperturaDeIncidente,
  codigoIncidente,
  dividirCola,
  incidentesActivos,
  minutosAbierto,
  moverSeleccion,
  ordenarCerrados,
  ordenarCola,
  unidadesPorIncidente,
} from './cola';

const inc = (
  id: string,
  nivel: NivelCriticidad,
  abierto: string | null,
  estado: EstadoIncidente = 'Abierto',
): Incidente => ({
  id,
  titulo: `Incidente ${id}`,
  nivel_criticidad: nivel,
  prioridad: PRIORIDAD_POR_CRITICIDAD[nivel],
  tipo: 'INCENDIO',
  estado,
  geometria: { type: 'Point', coordinates: [0, 0] },
  timeline: abierto ? [{ timestamp: abierto, descripcion: 'Registrado' }] : [],
});

const ids = (l: readonly Incidente[]) => l.map((i) => i.id);

describe('ordenarCola', () => {
  it('ordena por criticidad (Crítico, Medio, Bajo) y luego por antigüedad', () => {
    const cola = ordenarCola([
      inc('bajo', 'Bajo', '2026-10-07T08:00:00Z'),
      inc('medio-nuevo', 'Medio', '2026-10-07T10:00:00Z'),
      inc('critico-nuevo', 'Crítico', '2026-10-07T09:30:00Z'),
      inc('medio-viejo', 'Medio', '2026-10-07T07:00:00Z'),
      inc('critico-viejo', 'Crítico', '2026-10-07T06:00:00Z'),
    ]);
    expect(ids(cola)).toEqual(['critico-viejo', 'critico-nuevo', 'medio-viejo', 'medio-nuevo', 'bajo']);
  });

  it('a igual criticidad, el incidente sin fecha va al final y el empate se resuelve por id', () => {
    const cola = ordenarCola([
      inc('b', 'Medio', null),
      inc('c', 'Medio', '2026-10-07T09:00:00Z'),
      inc('a', 'Medio', null),
    ]);
    expect(ids(cola)).toEqual(['c', 'a', 'b']);
  });

  it('no muta la lista original', () => {
    const original = [inc('1', 'Bajo', null), inc('2', 'Crítico', null)];
    ordenarCola(original);
    expect(ids(original)).toEqual(['1', '2']);
  });
});

describe('activos y cerrados', () => {
  const todos = [
    inc('a', 'Crítico', '2026-10-07T08:00:00Z'),
    inc('b', 'Medio', '2026-10-07T08:30:00Z', 'Contenido'),
    inc('c', 'Crítico', '2026-10-07T07:00:00Z', 'Resuelto'),
  ];

  it('los resueltos se excluyen de "activos"; contenido sigue activo', () => {
    expect(ids(incidentesActivos(todos))).toEqual(['a', 'b']);
  });

  it('dividirCola separa la cola ordenada de los cerrados', () => {
    const { activos, cerrados } = dividirCola(todos);
    expect(ids(activos)).toEqual(['a', 'b']);
    expect(ids(cerrados)).toEqual(['c']);
  });

  it('los cerrados van del más reciente al más antiguo', () => {
    const cerrados = ordenarCerrados([
      inc('viejo', 'Bajo', '2026-10-06T08:00:00Z', 'Resuelto'),
      inc('nuevo', 'Bajo', '2026-10-07T08:00:00Z', 'Resuelto'),
    ]);
    expect(ids(cerrados)).toEqual(['nuevo', 'viejo']);
  });
});

describe('apertura y tiempo abierto', () => {
  it('la apertura es el evento más antiguo, aunque la línea de tiempo esté desordenada', () => {
    const i: Incidente = {
      ...inc('x', 'Bajo', null),
      timeline: [
        { timestamp: '2026-10-07T15:48:00Z', descripcion: 'b' },
        { timestamp: '2026-10-07T10:29:00Z', descripcion: 'a' },
        { timestamp: 'basura', descripcion: 'c' },
      ],
    };
    expect(aperturaDeIncidente(i)).toBe(Date.parse('2026-10-07T10:29:00Z'));
  });

  it('sin fechas válidas no hay apertura ni minutos', () => {
    expect(aperturaDeIncidente(inc('x', 'Bajo', null))).toBeNull();
    expect(minutosAbierto(inc('x', 'Bajo', null), Date.now())).toBeNull();
  });

  it('calcula minutos enteros y nunca negativos', () => {
    const i = inc('x', 'Bajo', '2026-10-07T10:00:00Z');
    expect(minutosAbierto(i, Date.parse('2026-10-07T10:04:59Z'))).toBe(4);
    expect(minutosAbierto(i, Date.parse('2026-10-07T09:00:00Z'))).toBe(0);
  });
});

describe('unidadesPorIncidente', () => {
  it('cuenta los recursos asignados a cada incidente', () => {
    const r = (id: string, incidenteId: string | null): Recurso => ({
      id,
      tipo: 'Bomberos',
      estado_actual: incidenteId ? 'ASIGNADO' : 'DISPONIBLE',
      incidente_asignado_id: incidenteId,
    });
    const mapa = unidadesPorIncidente([r('1', 'a'), r('2', 'a'), r('3', 'b'), r('4', null)]);
    expect(mapa.get('a')).toBe(2);
    expect(mapa.get('b')).toBe(1);
    expect(mapa.get('c')).toBeUndefined();
  });
});

describe('codigoIncidente', () => {
  it('toma las 3 últimas letras o dígitos del id, en mayúsculas', () => {
    expect(codigoIncidente('3f2a9c10-0b7e-4d51-9e8a-1c2d3e4f5a3f')).toBe('A3F');
    expect(codigoIncidente('demo-1')).toBe('MO1');
    expect(codigoIncidente('demo-2')).toBe('MO2');
  });
});

describe('moverSeleccion', () => {
  const orden = ['a', 'b', 'c'];

  it('avanza y retrocede sin dar la vuelta', () => {
    expect(moverSeleccion(orden, 'a', 1)).toBe('b');
    expect(moverSeleccion(orden, 'c', 1)).toBe('c');
    expect(moverSeleccion(orden, 'b', -1)).toBe('a');
    expect(moverSeleccion(orden, 'a', -1)).toBe('a');
  });

  it('sin selección válida empieza por el primero (J) o el último (K)', () => {
    expect(moverSeleccion(orden, null, 1)).toBe('a');
    expect(moverSeleccion(orden, null, -1)).toBe('c');
    expect(moverSeleccion(orden, 'borrado', 1)).toBe('a');
  });

  it('con la cola vacía no hay selección', () => {
    expect(moverSeleccion([], 'a', 1)).toBeNull();
  });
});
