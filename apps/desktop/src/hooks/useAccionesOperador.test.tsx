// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import type { GeoJsonPolygon, Incidente, Recurso, Reporte } from '@argos/shared';
import { crearServicioDemo } from '../services/servicioDemo';
import { useAccionesOperador } from './useAccionesOperador';

const poligono: GeoJsonPolygon = {
  type: 'Polygon',
  coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
};

async function montar(seleccionadoId: string | null = 'demo-1') {
  const servicio = crearServicioDemo();
  const incidentes = await servicio.listarIncidentes();
  const alAvisar = vi.fn();
  const alSeleccionar = vi.fn();
  const { result } = renderHook(() =>
    useAccionesOperador({ servicio, incidentes, seleccionadoId, alSeleccionar, alAvisar }),
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

    acciones.current.guardarPoligono(poligono);

    await waitFor(() => expect(alAvisar).toHaveBeenLastCalledWith(expect.stringContaining('Zona de riesgo guardada')));
    const actualizado = (await servicio.listarIncidentes()).find((i) => i.id === 'demo-1') as Incidente;
    expect(actualizado.geometria).toEqual(poligono);
    expect(actualizado.timeline).toHaveLength(antes + 1);
  });

  it('avisa si se traza una zona sin incidente seleccionado', async () => {
    const { servicio, acciones, alAvisar } = await montar(null);
    const actualizar = vi.spyOn(servicio, 'actualizarIncidente');
    acciones.current.guardarPoligono(poligono);
    expect(alAvisar).toHaveBeenCalledWith(expect.stringContaining('Selecciona un incidente'));
    expect(actualizar).not.toHaveBeenCalled();
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

    acciones.current.cambiarEstadoRecurso(libre, 'Despachado');
    await waitFor(async () =>
      expect((await servicio.listarRecursos()).find((r) => r.id === 'demo-rec-1')?.incidente_asignado_id).toBe('demo-2'),
    );

    acciones.current.cambiarEstadoRecurso(inoperativo, 'Despachado');
    await waitFor(() => expect(alAvisar).toHaveBeenCalledWith(expect.stringContaining('Transición inválida')));
  });

  it('guardarPoligono mantiene su identidad entre renders', async () => {
    const servicio = crearServicioDemo();
    const props = { servicio, incidentes: [], seleccionadoId: null as string | null, alSeleccionar: vi.fn(), alAvisar: vi.fn() };
    const { result, rerender } = renderHook((p) => useAccionesOperador(p), { initialProps: props });
    const primero = result.current.guardarPoligono;
    rerender({ ...props, seleccionadoId: 'x' });
    expect(result.current.guardarPoligono).toBe(primero);
  });
});
