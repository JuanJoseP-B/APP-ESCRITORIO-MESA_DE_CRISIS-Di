import { describe, expect, it, vi } from 'vitest';
import { crearServicioDemo } from './servicioDemo';

describe('servicioDemo (recursos)', () => {
  it('actualiza el recurso y notifica a los suscriptores', async () => {
    const servicio = crearServicioDemo();
    const alCambiar = vi.fn();
    const cancelar = servicio.suscribirRecursos(alCambiar);

    await servicio.cambiarEstadoRecurso('demo-rec-1', 'ASIGNADO', 'demo-1');

    expect(alCambiar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'UPDATE',
        nuevo: expect.objectContaining({ id: 'demo-rec-1', estado_actual: 'ASIGNADO' }),
      }),
    );
    const recursos = await servicio.listarRecursos();
    expect(recursos.find((r) => r.id === 'demo-rec-1')?.incidente_asignado_id).toBe('demo-1');

    cancelar();
    await servicio.cambiarEstadoRecurso('demo-rec-1', 'DISPONIBLE', null);
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('rechaza recursos inexistentes', async () => {
    await expect(crearServicioDemo().cambiarEstadoRecurso('nope', 'DISPONIBLE', null)).rejects.toThrow('nope');
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
    await expect(servicio.cambiarEstadoRecurso('demo-rec-1', 'ASIGNADO', 'demo-1')).resolves.toMatchObject({
      id: 'demo-rec-1',
      tipo: 'Bomberos',
      estado_actual: 'ASIGNADO',
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

describe('servicioDemo: ciclo de vida, eventos y llamadas', () => {
  const AHORA = Date.parse('2026-10-07T12:00:00Z');
  const servicioFijo = () => crearServicioDemo({ ahora: () => AHORA });

  it('recorre ASIGNADO → EN_RUTA → EN_ESCENA → DISPONIBLE y registra un evento por transición', async () => {
    const servicio = servicioFijo();
    const alEvento = vi.fn();
    servicio.suscribirEventosRecurso(alEvento);
    const antes = (await servicio.listarEventosRecurso()).length;

    await servicio.cambiarEstadoRecurso('demo-rec-1', 'ASIGNADO', 'demo-1', 'IA');
    await servicio.cambiarEstadoRecurso('demo-rec-1', 'EN_RUTA', null);
    await servicio.cambiarEstadoRecurso('demo-rec-1', 'EN_ESCENA', null);
    await servicio.cambiarEstadoRecurso('demo-rec-1', 'DISPONIBLE', null);

    const nuevos = (await servicio.listarEventosRecurso()).slice(antes);
    expect(nuevos.map((e) => `${e.desde}>${e.hacia}`)).toEqual([
      'DISPONIBLE>ASIGNADO',
      'ASIGNADO>EN_RUTA',
      'EN_RUTA>EN_ESCENA',
      'EN_ESCENA>DISPONIBLE',
    ]);
    expect(nuevos.map((e) => e.origen)).toEqual(['IA', 'MANUAL', 'MANUAL', 'MANUAL']);
    expect(nuevos.every((e) => e.incidenteId === 'demo-1' && e.creadoEn === '2026-10-07T12:00:00.000Z')).toBe(true);
    expect(alEvento).toHaveBeenCalledTimes(4);
  });

  it('rechaza una transición inválida como lo haría la base y no deja evento', async () => {
    const servicio = servicioFijo();
    const antes = (await servicio.listarEventosRecurso()).length;
    await expect(servicio.cambiarEstadoRecurso('demo-rec-1', 'EN_ESCENA', null)).rejects.toThrow('Transición inválida');
    expect((await servicio.listarEventosRecurso()).length).toBe(antes);
  });

  it('cancelar un despacho deja el evento con el incidente liberado y devuelve la unidad a su base', async () => {
    const servicio = servicioFijo();
    await servicio.cambiarEstadoRecurso('demo-rec-4', 'ASIGNADO', 'demo-2');
    const liberada = await servicio.cambiarEstadoRecurso('demo-rec-4', 'DISPONIBLE', null);
    expect(liberada).toMatchObject({ incidente_asignado_id: null, ubicacion: liberada.base });
    const ultimo = (await servicio.listarEventosRecurso()).at(-1);
    expect(ultimo).toMatchObject({ desde: 'ASIGNADO', hacia: 'DISPONIBLE', incidenteId: 'demo-2' });
  });

  it('al llegar a la escena la unidad toma la ubicación del incidente', async () => {
    const servicio = servicioFijo();
    await servicio.cambiarEstadoRecurso('demo-rec-4', 'ASIGNADO', 'demo-2');
    await servicio.cambiarEstadoRecurso('demo-rec-4', 'EN_RUTA', null);
    const enEscena = await servicio.cambiarEstadoRecurso('demo-rec-4', 'EN_ESCENA', null);
    expect(enEscena.ubicacion).toEqual({ lng: -70.61, lat: -33.43 });
  });

  it('las unidades que arrancan ocupadas traen su historia respecto a la hora del servicio', async () => {
    const eventos = await servicioFijo().listarEventosRecurso();
    const deRec3 = eventos.filter((e) => e.recursoId === 'demo-rec-3').map((e) => e.hacia);
    expect(deRec3).toEqual(['ASIGNADO', 'EN_RUTA', 'EN_ESCENA']);
    expect(eventos.find((e) => e.recursoId === 'demo-rec-2')?.creadoEn).toBe('2026-10-07T11:59:00.000Z');
  });

  it('corrige a mano la ubicación de una unidad sin generar evento', async () => {
    const servicio = servicioFijo();
    const antes = (await servicio.listarEventosRecurso()).length;
    const unidad = await servicio.actualizarUbicacionRecurso('demo-rec-1', { lat: -33.5, lng: -70.7 });
    expect(unidad.ubicacion).toEqual({ lat: -33.5, lng: -70.7 });
    expect((await servicio.listarEventosRecurso()).length).toBe(antes);
  });

  it('registra una llamada, la vincula y la descarta, y la bandeja de reportes la sigue viendo', async () => {
    const servicio = servicioFijo();
    const alCambiar = vi.fn();
    servicio.suscribirLlamadas(alCambiar);
    const nueva = await servicio.registrarLlamada({
      canal: 'PRESENCIAL',
      tipo: 'INCENDIO',
      prioridad: 'P1',
      ubicacion: { lat: -33.41, lng: -70.63 },
      narrativa: 'Llamas visibles',
      reportante: 'Guardabosque',
      callback: null,
    });
    expect(nueva).toMatchObject({ estadoValidacion: 'No confirmado', incidenteId: null, creadoEn: '2026-10-07T12:00:00.000Z' });
    expect(alCambiar).toHaveBeenCalledWith({ tipo: 'INSERT', nuevo: nueva, idEliminado: null });
    expect((await servicio.listarReportes()).some((r) => r.id === nueva.id && r.lat === -33.41)).toBe(true);

    await expect(servicio.vincularLlamada(nueva.id, 'demo-1')).resolves.toMatchObject({ incidenteId: 'demo-1', estadoValidacion: 'Confirmado' });
    await servicio.descartarLlamada('demo-r1');
    expect((await servicio.listarLlamadas()).find((l) => l.id === 'demo-r1')?.estadoValidacion).toBe('Descartado');
  });

  it('una llamada registrada con incidente nace vinculada', async () => {
    const llamada = await servicioFijo().registrarLlamada(
      { canal: '123', tipo: 'INCENDIO', prioridad: 'P2', ubicacion: { lat: 0, lng: 0 }, narrativa: '', reportante: null, callback: null },
      'demo-1',
    );
    expect(llamada).toMatchObject({ incidenteId: 'demo-1', estadoValidacion: 'Confirmado' });
  });

  it('sella con creado_en solo los eventos de bitácora que no lo traen y fija creado_en del incidente', async () => {
    const servicio = servicioFijo();
    const incidente = await servicio.crearIncidente({
      titulo: 'Nuevo',
      nivel_criticidad: 'Medio',
      prioridad: 'P2',
      tipo: null,
      estado: 'Abierto',
      geometria: { type: 'Point', coordinates: [0, 0] },
      timeline: [{ timestamp: '2026-10-07T11:00:00Z', descripcion: 'Antiguo', creado_en: '2026-10-07T11:00:01.000Z' }, { timestamp: '2020-01-01T00:00:00Z', descripcion: 'Nuevo' }],
    });
    expect(incidente.creado_en).toBe('2026-10-07T12:00:00.000Z');
    expect(incidente.timeline.map((e) => e.creado_en)).toEqual(['2026-10-07T11:00:01.000Z', '2026-10-07T12:00:00.000Z']);
  });
});
