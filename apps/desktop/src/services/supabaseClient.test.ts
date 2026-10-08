import { describe, expect, it, vi } from 'vitest';
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { aCambioRealtime, aSesion, crearServicioMesa, medirDesfaseServidor } from './supabaseClient';

type Fila = Record<string, unknown>;

/** Cliente simulado para la cadena `from().update().eq().select().single()`. */
function clienteUpdate(respuesta: { readonly data: Fila | null; readonly error: Fila | null }) {
  const single = vi.fn().mockResolvedValue(respuesta);
  const eq = vi.fn().mockReturnValue({ select: () => ({ single }) });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq };
}

/** Cliente simulado para la RPC `transicionar_recurso` y la lectura posterior del último evento. */
function clienteRpc(respuesta: { readonly data: Fila | null; readonly error: Fila | null }, eventos: readonly Fila[] = []) {
  const rpc = vi.fn().mockReturnValue({ single: () => Promise.resolve(respuesta) });
  const limit = vi.fn().mockResolvedValue({ data: eventos, error: null });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const from = vi.fn().mockReturnValue({ select: () => ({ eq }) });
  const canal = { on: vi.fn(), subscribe: vi.fn() };
  canal.on.mockReturnValue(canal);
  canal.subscribe.mockReturnValue(canal);
  const client = { rpc, from, channel: vi.fn().mockReturnValue(canal), removeChannel: vi.fn() } as unknown as SupabaseClient;
  return { client, rpc, from };
}

describe('aCambioRealtime', () => {
  it('traduce INSERT/UPDATE con la fila nueva', () => {
    const payload = {
      eventType: 'INSERT',
      new: { id: 'x' },
      old: {},
    } as unknown as RealtimePostgresChangesPayload<Fila>;
    expect(aCambioRealtime(payload)).toEqual({ tipo: 'INSERT', nuevo: { id: 'x' }, idEliminado: null });
  });

  it('traduce DELETE con el id eliminado', () => {
    const payload = {
      eventType: 'DELETE',
      new: {},
      old: { id: 'y' },
    } as unknown as RealtimePostgresChangesPayload<Fila>;
    expect(aCambioRealtime(payload)).toEqual({ tipo: 'DELETE', nuevo: null, idEliminado: 'y' });
  });
});

describe('crearServicioMesa', () => {
  it('lista incidentes desde la tabla incidentes', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: '1' }], error: null });
    const from = vi.fn().mockReturnValue({ select });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);

    await expect(servicio.listarIncidentes()).resolves.toEqual([{ id: '1' }]);
    expect(from).toHaveBeenCalledWith('incidentes');
  });

  it('propaga errores de lectura', async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const servicio = crearServicioMesa({ from: () => ({ select }) } as unknown as SupabaseClient);

    await expect(servicio.listarReportes()).rejects.toThrow('llamadas');
  });

  it('suscribe a la tabla y elimina el canal al cancelar', () => {
    const canal = { on: vi.fn(), subscribe: vi.fn() };
    canal.on.mockReturnValue(canal);
    canal.subscribe.mockReturnValue(canal);
    const removeChannel = vi.fn();
    const client = { channel: vi.fn().mockReturnValue(canal), removeChannel };

    const cancelar = crearServicioMesa(client as unknown as SupabaseClient).suscribirIncidentes(
      vi.fn(),
    );
    expect(canal.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'incidentes' },
      expect.any(Function),
    );

    cancelar();
    expect(removeChannel).toHaveBeenCalledWith(canal);
  });

  it('entrega a la bandeja cada reporte ciudadano que llega por Realtime', () => {
    type Manejador = (payload: RealtimePostgresChangesPayload<Fila>) => void;
    const canal = { on: vi.fn(), subscribe: vi.fn() };
    canal.on.mockReturnValue(canal);
    canal.subscribe.mockReturnValue(canal);
    const client = { channel: vi.fn().mockReturnValue(canal), removeChannel: vi.fn() };
    const alCambiar = vi.fn();

    crearServicioMesa(client as unknown as SupabaseClient).suscribirReportes(alCambiar);
    expect(canal.on).toHaveBeenCalledWith(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'llamadas' },
      expect.any(Function),
    );
    expect(canal.subscribe).toHaveBeenCalledOnce();

    const fila = { id: 'r9', tipo: 'DESLIZAMIENTO', lat: 1, lng: 2, imagen_url: null, estado_validacion: 'No confirmado' };
    const manejador = canal.on.mock.calls[0]?.[2] as Manejador;
    manejador({ eventType: 'INSERT', new: fila, old: {} } as unknown as RealtimePostgresChangesPayload<Fila>);
    expect(alCambiar).toHaveBeenCalledWith({ tipo: 'INSERT', nuevo: fila, idEliminado: null });
  });

  it('lista recursos desde recursos_operativos', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn().mockReturnValue({ select });
    await crearServicioMesa({ from } as unknown as SupabaseClient).listarRecursos();
    expect(from).toHaveBeenCalledWith('recursos_operativos');
  });

  it('cambia el estado con la RPC transicionar_recurso (una transacción) y devuelve la fila', async () => {
    const fila = { id: 'r1', tipo: 'Bomberos', estado_actual: 'ASIGNADO', incidente_asignado_id: 'inc-1' };
    const { client, rpc } = clienteRpc({ data: fila, error: null });
    const servicio = crearServicioMesa(client);

    await expect(servicio.cambiarEstadoRecurso('r1', 'ASIGNADO', 'inc-1')).resolves.toEqual(fila);

    expect(rpc).toHaveBeenCalledWith('transicionar_recurso', {
      p_id: 'r1',
      p_hacia: 'ASIGNADO',
      p_incidente: 'inc-1',
      p_origen: 'MANUAL',
    });
  });

  it('pasa el origen de la transición (p. ej. IA) a la RPC', async () => {
    const { client, rpc } = clienteRpc({ data: { id: 'r1' }, error: null });
    await crearServicioMesa(client).cambiarEstadoRecurso('r1', 'DISPONIBLE', null, 'IA');
    expect(rpc).toHaveBeenCalledWith('transicionar_recurso', expect.objectContaining({ p_incidente: null, p_origen: 'IA' }));
  });

  it('emite el recurso y su evento a los suscriptores sin esperar a Realtime y deja de hacerlo al cancelar', async () => {
    const fila = { id: 'r1', tipo: 'Bomberos', estado_actual: 'EN_ESCENA', incidente_asignado_id: 'inc-1' };
    const evento = { id: 'e1', recurso_id: 'r1', incidente_id: 'inc-1', desde: 'EN_RUTA', hacia: 'EN_ESCENA', origen: 'MANUAL', creado_en: '2026-10-07T12:00:00Z' };
    const { client } = clienteRpc({ data: fila, error: null }, [evento]);
    const servicio = crearServicioMesa(client);
    const alCambiar = vi.fn();
    const alEvento = vi.fn();
    const enOtraTabla = vi.fn();
    const cancelar = servicio.suscribirRecursos(alCambiar);
    servicio.suscribirEventosRecurso(alEvento);
    servicio.suscribirIncidentes(enOtraTabla);

    await servicio.cambiarEstadoRecurso('r1', 'EN_ESCENA', 'inc-1');
    expect(alCambiar).toHaveBeenCalledWith({ tipo: 'UPDATE', nuevo: fila, idEliminado: null });
    expect(alEvento).toHaveBeenCalledWith({
      tipo: 'INSERT',
      nuevo: { id: 'e1', recursoId: 'r1', incidenteId: 'inc-1', desde: 'EN_RUTA', hacia: 'EN_ESCENA', origen: 'MANUAL', creadoEn: '2026-10-07T12:00:00Z' },
      idEliminado: null,
    });
    expect(enOtraTabla).not.toHaveBeenCalled();

    cancelar();
    await servicio.cambiarEstadoRecurso('r1', 'EN_ESCENA', 'inc-1');
    expect(alCambiar).toHaveBeenCalledOnce();
  });

  it('si no se puede leer el último evento, el cambio de estado igualmente tiene éxito', async () => {
    const fila = { id: 'r1', tipo: 'Bomberos', estado_actual: 'DISPONIBLE', incidente_asignado_id: null };
    const rpc = vi.fn().mockReturnValue({ single: () => Promise.resolve({ data: fila, error: null }) });
    const from = vi.fn().mockImplementation(() => {
      throw new Error('sin red');
    });
    const servicio = crearServicioMesa({ rpc, from, channel: vi.fn(), removeChannel: vi.fn() } as unknown as SupabaseClient);
    await expect(servicio.cambiarEstadoRecurso('r1', 'DISPONIBLE', null)).resolves.toEqual(fila);
  });

  it('propaga el rechazo de la base ante una transición inválida', async () => {
    const { client } = clienteRpc({ data: null, error: { code: '23514', message: 'Transición de recurso inválida: DISPONIBLE -> EN_ESCENA' } });
    await expect(crearServicioMesa(client).cambiarEstadoRecurso('r1', 'EN_ESCENA', null)).rejects.toThrow('Transición de recurso inválida');
  });

  it('una RPC que no encuentra el recurso (RLS) falla en vez de pasar en silencio', async () => {
    const { client } = clienteRpc({ data: null, error: { code: 'PGRST116', message: 'JSON object requested' } });
    await expect(crearServicioMesa(client).cambiarEstadoRecurso('r1', 'DISPONIBLE', null)).rejects.toThrow('rol de operador');
  });

  it('corrige la ubicación de una unidad con un update de la columna ubicacion (sin evento)', async () => {
    const fila = { id: 'r1', tipo: 'Bomberos', estado_actual: 'DISPONIBLE', incidente_asignado_id: null, ubicacion: { lat: 1.2, lng: -77.3 } };
    const { from, update, eq } = clienteUpdate({ data: fila, error: null });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);

    await expect(servicio.actualizarUbicacionRecurso('r1', { lat: 1.2, lng: -77.3 })).resolves.toEqual(fila);
    expect(from).toHaveBeenCalledWith('recursos_operativos');
    expect(update).toHaveBeenCalledWith({ ubicacion: { lat: 1.2, lng: -77.3 } });
    expect(eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('lista las llamadas convertidas a Llamada', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: 'l1', canal: '123', tipo: 'INCENDIO', prioridad: 'P2', lat: 1.2, lng: -77.3, narrativa: 'x', incidente_id: null, estado_validacion: 'No confirmado', creado_en: '2026-10-07T12:00:00Z' }],
      error: null,
    });
    const from = vi.fn().mockReturnValue({ select });
    const [llamada] = await crearServicioMesa({ from } as unknown as SupabaseClient).listarLlamadas();
    expect(from).toHaveBeenCalledWith('llamadas');
    expect(llamada).toMatchObject({ id: 'l1', ubicacion: { lat: 1.2, lng: -77.3 }, incidenteId: null, estadoValidacion: 'No confirmado' });
  });

  it('registra una llamada con insert().select().single() y la devuelve como Llamada', async () => {
    const fila = { id: 'l9', canal: 'VHF', tipo: 'FUGA_GAS', prioridad: 'P1', lat: 1.21, lng: -77.28, narrativa: 'gas', incidente_id: 'i1', estado_validacion: 'Confirmado', creado_en: '2026-10-07T12:00:00Z' };
    const single = vi.fn().mockResolvedValue({ data: fila, error: null });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    const from = vi.fn().mockReturnValue({ insert });
    const canal = { on: vi.fn(), subscribe: vi.fn() };
    canal.on.mockReturnValue(canal);
    canal.subscribe.mockReturnValue(canal);
    const servicio = crearServicioMesa({ from, channel: () => canal, removeChannel: vi.fn() } as unknown as SupabaseClient);
    const alCambiar = vi.fn();
    servicio.suscribirLlamadas(alCambiar);

    const llamada = await servicio.registrarLlamada(
      { canal: 'VHF', tipo: 'FUGA_GAS', prioridad: 'P1', ubicacion: { lat: 1.21, lng: -77.28 }, narrativa: 'gas', reportante: null, callback: null },
      'i1',
    );

    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ lat: 1.21, lng: -77.28, incidente_id: 'i1', estado_validacion: 'Confirmado' }));
    expect(llamada.ubicacion).toEqual({ lat: 1.21, lng: -77.28 });
    expect(alCambiar).toHaveBeenCalledWith({ tipo: 'INSERT', nuevo: llamada, idEliminado: null });
  });

  it('vincular una llamada fija el incidente y la confirma; descartar la marca "Descartado"', async () => {
    const fila = { id: 'l1', canal: '123', tipo: 'INCENDIO', prioridad: 'P2', lat: 1, lng: 1, incidente_id: 'i1', estado_validacion: 'Confirmado' };
    const { from, update, eq } = clienteUpdate({ data: fila, error: null });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);

    await expect(servicio.vincularLlamada('l1', 'i1')).resolves.toMatchObject({ incidenteId: 'i1', estadoValidacion: 'Confirmado' });
    expect(update).toHaveBeenLastCalledWith({ incidente_id: 'i1', estado_validacion: 'Confirmado' });
    expect(eq).toHaveBeenLastCalledWith('id', 'l1');

    await servicio.descartarLlamada('l1');
    expect(update).toHaveBeenLastCalledWith({ estado_validacion: 'Descartado' });
  });

  it('lista los eventos de recurso convertidos a EventoRecurso', async () => {
    const select = vi.fn().mockResolvedValue({
      data: [{ id: 'e1', recurso_id: 'r1', incidente_id: null, desde: 'ASIGNADO', hacia: 'EN_RUTA', origen: 'IA', creado_en: '2026-10-07T12:00:00Z' }],
      error: null,
    });
    const from = vi.fn().mockReturnValue({ select });
    await expect(crearServicioMesa({ from } as unknown as SupabaseClient).listarEventosRecurso()).resolves.toEqual([
      { id: 'e1', recursoId: 'r1', incidenteId: null, desde: 'ASIGNADO', hacia: 'EN_RUTA', origen: 'IA', creadoEn: '2026-10-07T12:00:00Z' },
    ]);
    expect(from).toHaveBeenCalledWith('eventos_recurso');
  });

  it('los cambios de Realtime de llamadas llegan ya convertidos', () => {
    const canal = { on: vi.fn(), subscribe: vi.fn() };
    canal.on.mockReturnValue(canal);
    canal.subscribe.mockReturnValue(canal);
    const client = { channel: vi.fn().mockReturnValue(canal), removeChannel: vi.fn() };
    const alCambiar = vi.fn();
    crearServicioMesa(client as unknown as SupabaseClient).suscribirLlamadas(alCambiar);

    const entregar = canal.on.mock.calls[0]?.[2] as (p: RealtimePostgresChangesPayload<Fila>) => void;
    entregar({
      eventType: 'INSERT',
      new: { id: 'l2', canal: 'SENSOR', tipo: 'INUNDACION', prioridad: 'P3', lat: 2, lng: 3, incidente_id: null, estado_validacion: 'No confirmado' },
      old: {},
    } as unknown as RealtimePostgresChangesPayload<Fila>);

    expect(alCambiar).toHaveBeenCalledWith({
      tipo: 'INSERT',
      nuevo: expect.objectContaining({ id: 'l2', ubicacion: { lat: 2, lng: 3 }, canal: 'SENSOR' }),
      idEliminado: null,
    });
  });

  it('guarda el perímetro del incidente con update', async () => {
    const { from, update } = clienteUpdate({ data: { id: 'i1' }, error: null });
    const perimetro = { centro: { lat: 1, lng: 2 }, radios: { CALIENTE: 100, TIBIA: 300, EVACUACION: 500 }, origen: 'AUTO', poligonoManual: null } as const;
    await crearServicioMesa({ from } as unknown as SupabaseClient).actualizarIncidente('i1', { perimetro, perimetro_origen: 'AUTO' });
    expect(update).toHaveBeenCalledWith({ perimetro, perimetro_origen: 'AUTO' });
  });

  it('ajusta la ocupación con la RPC atómica enviando solo el delta', async () => {
    const fila = { id: 'z1', capacidad_actual: 15, capacidad_maxima: 100 };
    const single = vi.fn().mockResolvedValue({ data: fila, error: null });
    const rpc = vi.fn().mockReturnValue({ single });
    const from = vi.fn();
    const servicio = crearServicioMesa({ rpc, from } as unknown as SupabaseClient);

    await expect(servicio.ajustarOcupacionZona('z1', -5)).resolves.toEqual(fila);

    expect(rpc).toHaveBeenCalledWith('ajustar_ocupacion_zona', { p_id: 'z1', p_delta: -5 });
    expect(from).not.toHaveBeenCalled();
  });

  it('propaga errores de la RPC de ocupación', async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: 'function not found' } });
    const servicio = crearServicioMesa({ rpc: () => ({ single }) } as unknown as SupabaseClient);
    await expect(servicio.ajustarOcupacionZona('z1', 5)).rejects.toThrow('function not found');
  });

  it('guarda una figura trazada en zonas_publicas', async () => {
    const nueva = {
      tipo: 'Bloqueo de Vía',
      nombre: 'Zona trazada',
      geometria: { type: 'Polygon', coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]] },
      capacidad_actual: 0,
      capacidad_maxima: 0,
    } as const;
    const single = vi.fn().mockResolvedValue({ data: { ...nueva, id: 'z9' }, error: null });
    const insert = vi.fn().mockReturnValue({ select: () => ({ single }) });
    const from = vi.fn().mockReturnValue({ insert });

    const creada = await crearServicioMesa({ from } as unknown as SupabaseClient).crearZonaPublica(nueva);

    expect(from).toHaveBeenCalledWith('zonas_publicas');
    expect(insert).toHaveBeenCalledWith(nueva);
    expect(creada.id).toBe('z9');
  });

  it('crea un incidente con insert().select().single()', async () => {
    const fila = { id: 'n1', titulo: 'x' };
    const single = vi.fn().mockResolvedValue({ data: fila, error: null });
    const select = vi.fn().mockReturnValue({ single });
    const insert = vi.fn().mockReturnValue({ select });
    const from = vi.fn().mockReturnValue({ insert });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);
    const nuevo = {
      titulo: 'x',
      nivel_criticidad: 'Medio',
      prioridad: 'P2',
      tipo: null,
      estado: 'Abierto',
      geometria: { type: 'Point', coordinates: [0, 0] },
      timeline: [],
    } as const;

    await expect(servicio.crearIncidente(nuevo)).resolves.toEqual(fila);
    expect(from).toHaveBeenCalledWith('incidentes');
    expect(insert).toHaveBeenCalledWith(nuevo);
  });

  it.each([
    ['actualizarIncidente', 'incidentes', (s: ReturnType<typeof crearServicioMesa>) => s.actualizarIncidente('i1', { estado: 'Resuelto' }), { estado: 'Resuelto' }],
    ['actualizarEstadoReporte', 'llamadas', (s: ReturnType<typeof crearServicioMesa>) => s.actualizarEstadoReporte('i1', 'Confirmado'), { estado_validacion: 'Confirmado' }],
  ])('%s hace update().eq("id")', async (_nombre, tabla, accion, cambios) => {
    const { from, update, eq } = clienteUpdate({ data: { id: 'i1' }, error: null });

    await accion(crearServicioMesa({ from } as unknown as SupabaseClient));

    expect(from).toHaveBeenCalledWith(tabla);
    expect(update).toHaveBeenCalledWith(cambios);
    expect(eq).toHaveBeenCalledWith('id', 'i1');
  });

  it('inicia sesión y deriva el rol de app_metadata', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      data: { user: { email: 'op@x.com', app_metadata: { rol: 'operador' } } },
      error: null,
    });
    const servicio = crearServicioMesa({ auth: { signInWithPassword } } as unknown as SupabaseClient);

    await expect(servicio.iniciarSesion('op@x.com', 'pw')).resolves.toEqual({ email: 'op@x.com', esOperador: true });
    expect(signInWithPassword).toHaveBeenCalledWith({ email: 'op@x.com', password: 'pw' });
  });

  it('rechaza credenciales inválidas y no confunde user_metadata con rol', async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Invalid login' } });
    const servicio = crearServicioMesa({ auth: { signInWithPassword } } as unknown as SupabaseClient);
    await expect(servicio.iniciarSesion('a', 'b')).rejects.toThrow('Invalid login');
    expect(aSesion('c@x.com', { rol: 'ciudadano' }).esOperador).toBe(false);
    expect(aSesion('c@x.com', undefined).esOperador).toBe(false);
  });

  it('sesionActual devuelve null sin sesión y la sesión si existe', async () => {
    const getSession = vi.fn()
      .mockResolvedValueOnce({ data: { session: null } })
      .mockResolvedValueOnce({ data: { session: { user: { email: 'o@x.com', app_metadata: { rol: 'operador' } } } } });
    const servicio = crearServicioMesa({ auth: { getSession } } as unknown as SupabaseClient);
    await expect(servicio.sesionActual()).resolves.toBeNull();
    await expect(servicio.sesionActual()).resolves.toEqual({ email: 'o@x.com', esOperador: true });
  });

  it('cierra sesión con auth.signOut', async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    await crearServicioMesa({ auth: { signOut } } as unknown as SupabaseClient).cerrarSesion();
    expect(signOut).toHaveBeenCalled();
  });
});

describe('desfase de la hora del servidor', () => {
  const sinCliente = {} as unknown as SupabaseClient;
  const respuesta = (date: string | null) => ({ headers: new Headers(date ? { date } : {}) }) as unknown as Response;

  it('crearServicioMesa devuelve 0 si no se le da medidor', async () => {
    await expect(crearServicioMesa(sinCliente).desfaseHoraServidorMs()).resolves.toBe(0);
  });

  it('crearServicioMesa delega en el medidor recibido', async () => {
    const servicio = crearServicioMesa(sinCliente, () => Promise.resolve(1500));
    await expect(servicio.desfaseHoraServidorMs()).resolves.toBe(1500);
  });

  it('mide con la cabecera Date: servidor 4 s adelantado', async () => {
    const servidor = Date.UTC(2026, 9, 7, 22, 15, 7);
    const marcas = [servidor - 4_000 - 100, servidor - 4_000 + 100];
    const pedir = vi.fn().mockResolvedValue(respuesta(new Date(servidor).toUTCString()));
    const desfase = await medirDesfaseServidor('https://x.supabase.co/', 'clave', pedir, () => marcas.shift() ?? 0);
    expect(desfase).toBe(4_000);
    expect(pedir).toHaveBeenCalledWith('https://x.supabase.co/rest/v1/', { method: 'HEAD', headers: { apikey: 'clave' } });
  });

  it('devuelve 0 si la cabecera no está expuesta o la red falla', async () => {
    await expect(medirDesfaseServidor('https://x', 'k', vi.fn().mockResolvedValue(respuesta(null)))).resolves.toBe(0);
    await expect(medirDesfaseServidor('https://x', 'k', vi.fn().mockRejectedValue(new Error('sin red')))).resolves.toBe(0);
  });
});
