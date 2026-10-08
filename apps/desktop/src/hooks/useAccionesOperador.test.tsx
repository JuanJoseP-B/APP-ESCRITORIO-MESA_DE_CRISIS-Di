// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { GeoJsonPolygon, Incidente, Recurso, Reporte, ZonaPublica } from '@argos/shared';
import { crearServicioDemo } from '../services/servicioDemo';
import { useAccionesOperador } from './useAccionesOperador';

const poligono: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
};

async function montar(seleccionadoId: string | null = 'demo-1', operador?: string) {
  const servicio = crearServicioDemo();
  const incidentes = await servicio.listarIncidentes();
  const alAvisar = vi.fn();
  const alSeleccionar = vi.fn();
  const { result } = renderHook(() =>
    useAccionesOperador({ servicio, incidentes, seleccionadoId, alSeleccionar, alAvisar, operador }),
  );
  return { servicio, incidentes, alAvisar, alSeleccionar, acciones: result };
}

describe('useAccionesOperador', () => {
  it('confirmar reporte crea el incidente, marca Confirmado y lo selecciona', async () => {
    const { servicio, acciones, alSeleccionar } = await montar();
    const reporte = (await servicio.listarReportes())[0] as Reporte;

    acciones.current.confirmarReporte(reporte);

    await waitFor(() => expect(alSeleccionar).toHaveBeenCalled());
    expect((await servicio.listarReportes())[0]?.estado_validacion).toBe('Confirmado');
    const creado = (await servicio.listarIncidentes()).find((i) => i.id === alSeleccionar.mock.calls[0]?.[0]);
    expect(creado?.geometria).toEqual({ type: 'Point', coordinates: [reporte.lng, reporte.lat] });
  });

  it('descartar reporte lo marca Descartado', async () => {
    const { servicio, acciones } = await montar();
    acciones.current.descartarReporte((await servicio.listarReportes())[0] as Reporte);
    await waitFor(async () => expect((await servicio.listarReportes())[0]?.estado_validacion).toBe('Descartado'));
  });

  it('guarda el polígono en el incidente seleccionado y registra el evento', async () => {
    const { servicio, acciones, alAvisar, incidentes } = await montar('demo-1');
    const antes = incidentes.find((i) => i.id === 'demo-1')?.timeline.length ?? 0;

    acciones.current.guardarTrazado(poligono);

    await waitFor(() => expect(alAvisar).toHaveBeenLastCalledWith(expect.stringContaining('Zona de riesgo guardada')));
    const actualizado = (await servicio.listarIncidentes()).find((i) => i.id === 'demo-1') as Incidente;
    expect(actualizado.geometria).toEqual(poligono);
    expect(actualizado.timeline).toHaveLength(antes + 1);
    expect(await servicio.listarZonasPublicas()).toHaveLength(2);
  });

  it('sin incidente seleccionado guarda el polígono en zonas_publicas', async () => {
    const { servicio, acciones, alAvisar } = await montar(null);
    const actualizar = vi.spyOn(servicio, 'actualizarIncidente');

    acciones.current.guardarTrazado(poligono);

    await waitFor(() => expect(alAvisar).toHaveBeenLastCalledWith(expect.stringContaining('guardado en zonas públicas')));
    expect(actualizar).not.toHaveBeenCalled();
    const creada = (await servicio.listarZonasPublicas()).at(-1);
    expect(creada).toMatchObject({ tipo: 'Bloqueo de Vía', geometria: poligono, capacidad_maxima: 0 });
  });

  it('una línea va siempre a zonas_publicas, aunque haya incidente seleccionado', async () => {
    const { servicio, acciones, alAvisar } = await montar('demo-1');
    const linea = { type: 'LineString', coordinates: [[0, 0], [1, 1]] } as const;

    acciones.current.guardarTrazado(linea);

    await waitFor(() => expect(alAvisar).toHaveBeenLastCalledWith(expect.stringContaining('guardado en zonas públicas')));
    expect((await servicio.listarZonasPublicas()).at(-1)?.geometria).toEqual(linea);
    expect((await servicio.listarIncidentes()).find((i) => i.id === 'demo-1')?.geometria.type).toBe('Polygon');
  });

  it('cambia la ocupación de un refugio enviando el delta al servicio', async () => {
    const { servicio, acciones } = await montar();
    const ajustar = vi.spyOn(servicio, 'ajustarOcupacionZona');
    const zona = (await servicio.listarZonasPublicas())[0] as ZonaPublica;

    acciones.current.cambiarOcupacion(zona, -5);

    await waitFor(async () => expect((await servicio.listarZonasPublicas())[0]?.capacidad_actual).toBe(40));
    expect(ajustar).toHaveBeenCalledWith('demo-z1', -5);
  });

  it('cambia el estado del incidente y lo registra en el timeline', async () => {
    const { servicio, acciones, incidentes } = await montar();
    acciones.current.cambiarEstadoIncidente(incidentes[0] as Incidente, 'Resuelto');
    await waitFor(async () =>
      expect((await servicio.listarIncidentes()).find((i) => i.id === incidentes[0]?.id)?.estado).toBe('Resuelto'),
    );
  });

  it('despacha recursos al incidente seleccionado y avisa de transiciones inválidas', async () => {
    const { servicio, acciones, alAvisar } = await montar('demo-2');
    const [libre, inoperativo] = [
      (await servicio.listarRecursos()).find((r) => r.id === 'demo-rec-1') as Recurso,
      (await servicio.listarRecursos()).find((r) => r.id === 'demo-rec-5') as Recurso,
    ];

    acciones.current.cambiarEstadoRecurso(libre, 'ASIGNADO');
    await waitFor(async () =>
      expect((await servicio.listarRecursos()).find((r) => r.id === 'demo-rec-1')?.incidente_asignado_id).toBe('demo-2'),
    );

    acciones.current.cambiarEstadoRecurso(inoperativo, 'ASIGNADO');
    await waitFor(() => expect(alAvisar).toHaveBeenCalledWith(expect.stringContaining('Transición inválida')));
  });

  it('despachar con incidenteId explícito prevalece sobre el seleccionado', async () => {
    const { servicio, acciones } = await montar('demo-2');
    const libre = (await servicio.listarRecursos()).find((r) => r.id === 'demo-rec-4') as Recurso;

    acciones.current.cambiarEstadoRecurso(libre, 'ASIGNADO', 'demo-1');
    await waitFor(async () =>
      expect((await servicio.listarRecursos()).find((r) => r.id === 'demo-rec-4')?.incidente_asignado_id).toBe('demo-1'),
    );
  });

  it('el operador queda como autor de los eventos que añade a la bitácora', async () => {
    const { servicio, acciones, incidentes } = await montar('demo-1', 'operador@argos.test');
    const demo1 = incidentes.find((i) => i.id === 'demo-1') as Incidente;

    acciones.current.cambiarEstadoIncidente(demo1, 'Contenido');
    await waitFor(async () =>
      expect((await servicio.listarIncidentes()).find((i) => i.id === 'demo-1')?.estado).toBe('Contenido'),
    );
    const ultimo = (await servicio.listarIncidentes()).find((i) => i.id === 'demo-1')?.timeline.at(-1);
    expect(ultimo).toMatchObject({ descripcion: 'Estado cambiado a Contenido', autor: 'operador@argos.test' });
  });

  it('un incidente creado al confirmar un reporte lleva al operador como autor del primer evento', async () => {
    const { servicio, acciones, alSeleccionar } = await montar('demo-1', 'operador@argos.test');
    acciones.current.confirmarReporte((await servicio.listarReportes())[0] as Reporte);
    await waitFor(() => expect(alSeleccionar).toHaveBeenCalled());
    const creado = (await servicio.listarIncidentes()).find((i) => i.id === alSeleccionar.mock.calls[0]?.[0]);
    expect(creado?.timeline[0]).toMatchObject({ autor: 'operador@argos.test' });
  });

  it('guardarTrazado mantiene su identidad entre renders', async () => {
    const servicio = crearServicioDemo();
    const props = { servicio, incidentes: [], seleccionadoId: null as string | null, alSeleccionar: vi.fn(), alAvisar: vi.fn() };
    const { result, rerender } = renderHook((p) => useAccionesOperador(p), { initialProps: props });
    const primero = result.current.guardarTrazado;
    rerender({ ...props, seleccionadoId: 'x' });
    expect(result.current.guardarTrazado).toBe(primero);
  });
});
