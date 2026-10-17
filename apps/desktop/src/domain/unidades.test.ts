import { describe, expect, it } from 'vitest';
import type { EstadoRecurso, Recurso, TipoRecurso } from '@argos/shared';
import { indicativosDe, ordenarUnidades, resumirUnidades } from './unidades';

const rec = (id: string, tipo: TipoRecurso, etiqueta?: string | null, estado: EstadoRecurso = 'DISPONIBLE'): Recurso => ({
  id,
  tipo,
  estado_actual: estado,
  incidente_asignado_id: null,
  ...(etiqueta === undefined ? {} : { etiqueta }),
});

describe('indicativosDe', () => {
  it('usa la etiqueta guardada tal cual', () => {
    const mapa = indicativosDe([rec('1', 'Bomberos', 'U01'), rec('2', 'Ambulancia', ' M-12 ')]);
    expect(mapa.get('1')).toBe('U01');
    expect(mapa.get('2')).toBe('M-12');
  });

  it('sin etiqueta genera <inicial>-<NN> por tipo, en orden de id', () => {
    const mapa = indicativosDe([
      rec('b', 'Bomberos'),
      rec('a', 'Bomberos'),
      rec('z', 'Ambulancia', null),
      rec('p', 'Policía', ''),
    ]);
    expect(mapa.get('a')).toBe('B-01');
    expect(mapa.get('b')).toBe('B-02');
    expect(mapa.get('z')).toBe('M-01');
    expect(mapa.get('p')).toBe('P-01');
  });

  it('el indicativo no se trunca aunque tenga dos dígitos', () => {
    const doce = Array.from({ length: 12 }, (_, n) => rec(`id-${String(n).padStart(2, '0')}`, 'Ambulancia'));
    expect(indicativosDe(doce).get('id-11')).toBe('M-12');
  });
});

describe('ordenarUnidades', () => {
  it('ordena por tipo y luego por indicativo numérico', () => {
    const orden = ordenarUnidades([
      rec('1', 'Policía', 'P01'),
      rec('2', 'Ambulancia', 'M11'),
      rec('3', 'Bomberos', 'U10'),
      rec('4', 'Bomberos', 'U02'),
      rec('5', 'Ambulancia', 'M02'),
    ]);
    expect(orden.map((r) => r.etiqueta)).toEqual(['U02', 'U10', 'M02', 'M11', 'P01']);
  });

  it('no muta la lista original', () => {
    const original = [rec('1', 'Policía', 'P01'), rec('2', 'Bomberos', 'U01')];
    ordenarUnidades(original);
    expect(original.map((r) => r.id)).toEqual(['1', '2']);
  });
});

describe('resumirUnidades', () => {
  it('cuenta el total y las disponibles', () => {
    expect(
      resumirUnidades([rec('1', 'Bomberos', 'U1'), rec('2', 'Bomberos', 'U2', 'ASIGNADO'), rec('3', 'Policía', 'P1', 'INOPERATIVO')]),
    ).toEqual({ total: 3, disponibles: 1 });
    expect(resumirUnidades([])).toEqual({ total: 0, disponibles: 0 });
  });
});
