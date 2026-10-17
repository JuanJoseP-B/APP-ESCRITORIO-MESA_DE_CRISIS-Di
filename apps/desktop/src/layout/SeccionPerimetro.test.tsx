// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RADIOS_POR_DEFECTO, type Recurso, type ZonaPublica } from '@argos/shared';
import { analizarPerimetro } from '../domain/analisisEspacial';
import { generarAnillos } from '../domain/perimetro';
import type { UnidadMapa } from '../domain/unidadesMapa';
import { SeccionPerimetro } from './SeccionPerimetro';

afterEach(cleanup);

const centro = { lat: 1.2136, lng: -77.2811 };
const anillos = generarAnillos(centro, RADIOS_POR_DEFECTO);
const alNorte = (m: number): [number, number] => [centro.lng, centro.lat + m / 111_195];

const refugio = (id: string, nombre: string, metros: number): ZonaPublica => ({
  id,
  tipo: 'Refugio',
  nombre,
  geometria: { type: 'Point', coordinates: alNorte(metros) },
  capacidad_actual: 0,
  capacidad_maxima: 50,
});
const bloqueo: ZonaPublica = {
  id: 'b1',
  tipo: 'Bloqueo de Vía',
  nombre: 'Puente cerrado',
  geometria: { type: 'Point', coordinates: alNorte(250) },
  capacidad_actual: 0,
  capacidad_maxima: 0,
};

const recurso = (id: string, etiqueta: string): Recurso => ({ id, etiqueta, tipo: 'Ambulancia', estado_actual: 'EN_ESCENA', incidente_asignado_id: 'i1' });
const unidadMapa = (id: string, metros: number, incidenteId: string | null = null): UnidadMapa => {
  const [lng, lat] = alNorte(metros);
  return { id, indicativo: id, tipo: 'Ambulancia', estado: 'EN_ESCENA', incidenteId, posicion: { lat, lng }, atenuada: false };
};

function montar(unidades: readonly UnidadMapa[], onResaltar = vi.fn(), incidenteId: string | null = null) {
  const zonas = [refugio('z1', 'Coliseo', 200), refugio('z2', 'Colegio', 450), refugio('z3', 'Estadio', 2000), bloqueo];
  const recursos = [recurso('m11', 'M11'), recurso('u02', 'U02')];
  const indicativos = new Map([['m11', 'M11'], ['u02', 'U02']]);
  render(
    <SeccionPerimetro
      indice="02"
      anillos={anillos}
      analisis={analizarPerimetro(anillos, zonas, unidades, incidenteId)}
      zonas={zonas}
      recursos={recursos}
      indicativos={indicativos}
      onResaltar={onResaltar}
    />,
  );
  return onResaltar;
}

describe('SeccionPerimetro', () => {
  it('rotula los tres anillos con su radio', () => {
    montar([]);
    const lista = screen.getByRole('list', { name: 'Anillos del perímetro' });
    expect(within(lista).getAllByRole('listitem').map((i) => i.textContent)).toEqual([
      'Zona caliente 100 m',
      'Zona tibia 300 m',
      'Zona de evacuación 500 m',
    ]);
  });

  it('marca cada refugio como apto o no apto, con glifo y palabra', () => {
    montar([]);
    const filas = within(screen.getByRole('list', { name: 'Refugios por anillo' })).getAllByRole('listitem');
    expect(filas.map((f) => f.textContent)).toEqual([
      'Coliseo · Zona tibiaNO APTO',
      'Colegio · Zona de evacuaciónAPTO',
      'Estadio · Fuera del perímetroAPTO',
    ]);
    expect(filas.every((f) => f.querySelector('.ag-glyph') !== null)).toBe(true);
  });

  it('lista los bloqueos que cruzan el perímetro', () => {
    montar([]);
    expect(within(screen.getByRole('list', { name: 'Bloqueos que cruzan el perímetro' })).getByText('Puente cerrado')).toBeTruthy();
  });

  it('sin unidades en la zona caliente no hay alerta', () => {
    montar([unidadMapa('m11', 400)]);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Ninguna unidad dentro de la zona caliente')).toBeTruthy();
  });

  it('con unidades en la zona caliente muestra una alerta que las nombra', () => {
    montar([unidadMapa('m11', 0), unidadMapa('u02', 60)]);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('ALERTA · Unidades dentro de la zona caliente');
    expect(within(alerta).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['M11 · Ambulancia', 'U02 · Ambulancia']);
    expect(alerta.querySelector('.ag-glyph')).not.toBeNull();
  });

  it('las unidades asignadas al incidente aparecen «en escena», sin alerta, y las demás sí alertan', () => {
    montar([unidadMapa('m11', 0, 'i1'), unidadMapa('u02', 60, 'otro')], vi.fn(), 'i1');
    const alerta = screen.getByRole('alert');
    expect(within(alerta).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['U02 · Ambulancia']);
    const enEscena = screen.getByRole('list', { name: 'En escena · Unidades asignadas a este incidente' });
    expect(within(enEscena).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['M11 · Ambulancia']);
    expect(enEscena.closest('[role="alert"]')).toBeNull();
  });

  it('si solo hay unidades asignadas no hay alerta', () => {
    montar([unidadMapa('m11', 0, 'i1')], vi.fn(), 'i1');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByText('Ninguna unidad dentro de la zona caliente')).toBeTruthy();
  });

  it('señalar un ítem lo resalta en el mapa y soltarlo lo quita', async () => {
    const onResaltar = montar([unidadMapa('m11', 0)]);
    await userEvent.hover(screen.getByText('Coliseo · Zona tibia'));
    expect(onResaltar).toHaveBeenLastCalledWith({ tipo: 'zona', id: 'z1' });
    await userEvent.unhover(screen.getByText('Coliseo · Zona tibia'));
    expect(onResaltar).toHaveBeenLastCalledWith(null);
    await userEvent.hover(within(screen.getByRole('alert')).getByText('M11 · Ambulancia'));
    expect(onResaltar).toHaveBeenLastCalledWith({ tipo: 'unidad', id: 'm11' });
  });

  it('también responde al foco del teclado', async () => {
    const onResaltar = montar([]);
    await userEvent.tab();
    expect(onResaltar).toHaveBeenLastCalledWith(expect.objectContaining({ tipo: 'zona' }));
  });
});
