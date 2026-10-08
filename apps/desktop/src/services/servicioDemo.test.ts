import { describe, expect, it, vi } from 'vitest';
import { crearServicioDemo } from './servicioDemo';

describe('servicioDemo (recursos)', () => {
  it('actualiza el recurso y notifica a los suscriptores', async () => {
    const servicio = crearServicioDemo();
    const alCambiar = vi.fn();
    const cancelar = servicio.suscribirRecursos(alCambiar);

    await servicio.cambiarEstadoRecurso('demo-rec-1', 'Despachado', 'demo-1');

    expect(alCambiar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'UPDATE',
        nuevo: expect.objectContaining({ id: 'demo-rec-1', estado_actual: 'Despachado' }),
      }),
    );
    const recursos = await servicio.listarRecursos();
    expect(recursos.find((r) => r.id === 'demo-rec-1')?.incidente_asignado_id).toBe('demo-1');

    cancelar();
    await servicio.cambiarEstadoRecurso('demo-rec-1', 'Disponible', null);
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('rechaza recursos inexistentes', async () => {
    await expect(crearServicioDemo().cambiarEstadoRecurso('nope', 'Disponible', null)).rejects.toThrow('nope');
  });
});

describe('servicioDemo (incidentes, reportes y refugios)', () => {
  it('crea incidentes y notifica el INSERT', async () => {
    const servicio = crearServicioDemo();
    const alCambiar = vi.fn();
    servicio.suscribirIncidentes(alCambiar);

    const creado = await servicio.crearIncidente({
      titulo: 'Nuevo',
      nivel_criticidad: 'Medio',
      prioridad: 'P2',
      tipo: null,
      estado: 'Abierto',
      geometria: { type: 'Point', coordinates: [0, 0] },
      timeline: [],
    });

    expect(creado.id).toMatch(/^demo-i/);
    expect(alCambiar).toHaveBeenCalledWith(expect.objectContaining({ tipo: 'INSERT' }));
    expect((await servicio.listarIncidentes()).some((i) => i.id === creado.id)).toBe(true);
  });

  it('actualiza reporte, incidente y ocupación de refugio', async () => {
    const servicio = crearServicioDemo();
    await servicio.actualizarEstadoReporte('demo-r1', 'Confirmado');
    await servicio.actualizarIncidente('demo-1', { estado: 'Resuelto' });
    await servicio.ajustarOcupacionZona('demo-z1', 5);

    expect((await servicio.listarReportes())[0]?.estado_validacion).toBe('Confirmado');
    expect((await servicio.listarIncidentes()).find((i) => i.id === 'demo-1')?.estado).toBe('Resuelto');
    expect((await servicio.listarZonasPublicas()).find((z) => z.id === 'demo-z1')?.capacidad_actual).toBe(50);
  });

  it('ajusta la ocupación de forma relativa: dos pulsaciones simultáneas suman y el resultado se acota', async () => {
    const servicio = crearServicioDemo();
    const [a, b] = await Promise.all([
      servicio.ajustarOcupacionZona('demo-z1', 5),
      servicio.ajustarOcupacionZona('demo-z1', 5),
    ]);
    expect([a.capacidad_actual, b.capacidad_actual]).toEqual([50, 55]);
    await expect(servicio.ajustarOcupacionZona('demo-z1', -1000)).resolves.toMatchObject({ capacidad_actual: 0 });
    await expect(servicio.ajustarOcupacionZona('demo-z1', 1000)).resolves.toMatchObject({ capacidad_actual: 200 });
  });

  it('crea una zona pública trazada y la notifica', async () => {
    const servicio = crearServicioDemo();
    const alCambiar = vi.fn();
    servicio.suscribirZonasPublicas(alCambiar);
    const zona = await servicio.crearZonaPublica({
      tipo: 'Bloqueo de Vía',
      nombre: 'Tramo',
      geometria: { type: 'LineString', coordinates: [[0, 0], [1, 1]] },
      capacidad_actual: 0,
      capacidad_maxima: 0,
    });
    expect(alCambiar).toHaveBeenCalledWith({ tipo: 'INSERT', nuevo: zona, idEliminado: null });
    expect(await servicio.listarZonasPublicas()).toContainEqual(zona);
  });

  it('cambiar el estado de un recurso devuelve la fila guardada', async () => {
    const servicio = crearServicioDemo();
    await expect(servicio.cambiarEstadoRecurso('demo-rec-1', 'Despachado', 'demo-1')).resolves.toEqual({
      id: 'demo-rec-1',
      tipo: 'Bomberos',
      estado_actual: 'Despachado',
      incidente_asignado_id: 'demo-1',
    });
  });

  it('simula sesión de operador', async () => {
    await expect(crearServicioDemo().sesionActual()).resolves.toMatchObject({ esOperador: true });
  });
});

describe('servicioDemo: hora del servidor', () => {
  it('no hay desfase: la hora del equipo es la de referencia', async () => {
    await expect(crearServicioDemo().desfaseHoraServidorMs()).resolves.toBe(0);
  });
});
