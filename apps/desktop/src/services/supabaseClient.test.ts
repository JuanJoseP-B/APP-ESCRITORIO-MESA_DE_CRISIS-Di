import { describe, expect, it, vi } from 'vitest';
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { aCambioRealtime, aSesion, crearServicioMesa } from './supabaseClient';

type Fila = Record<string, unknown>;

/** Cliente simulado para la cadena `from().update().eq().select().single()`. */
function clienteUpdate(respuesta: { readonly data: Fila | null; readonly error: Fila | null }) {
  const single = vi.fn().mockResolvedValue(respuesta);
  const eq = vi.fn().mockReturnValue({ select: () => ({ single }) });
  const update = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ update });
  return { from, update, eq };
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

  it('cambia el estado de un recurso con update().eq().select().single() y devuelve la fila', async () => {
    const fila = { id: 'r1', tipo: 'Bomberos', estado_actual: 'Despachado', incidente_asignado_id: 'inc-1' };
    const { from, update, eq } = clienteUpdate({ data: fila, error: null });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);

    await expect(servicio.cambiarEstadoRecurso('r1', 'Despachado', 'inc-1')).resolves.toEqual(fila);

    expect(from).toHaveBeenCalledWith('recursos_operativos');
    expect(update).toHaveBeenCalledWith({ estado_actual: 'Despachado', incidente_asignado_id: 'inc-1' });
    expect(eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('emite la fila guardada a los suscriptores sin esperar a Realtime y deja de hacerlo al cancelar', async () => {
    const fila = { id: 'r1', tipo: 'Bomberos', estado_actual: 'En Escena', incidente_asignado_id: 'inc-1' };
    const canal = { on: vi.fn(), subscribe: vi.fn() };
    canal.on.mockReturnValue(canal);
    canal.subscribe.mockReturnValue(canal);
    const { from } = clienteUpdate({ data: fila, error: null });
    const client = { from, channel: vi.fn().mockReturnValue(canal), removeChannel: vi.fn() };
    const servicio = crearServicioMesa(client as unknown as SupabaseClient);
    const alCambiar = vi.fn();
    const enOtraTabla = vi.fn();
    const cancelar = servicio.suscribirRecursos(alCambiar);
    servicio.suscribirIncidentes(enOtraTabla);

    await servicio.cambiarEstadoRecurso('r1', 'En Escena', 'inc-1');
    expect(alCambiar).toHaveBeenCalledWith({ tipo: 'UPDATE', nuevo: fila, idEliminado: null });
    expect(enOtraTabla).not.toHaveBeenCalled();

    cancelar();
    await servicio.cambiarEstadoRecurso('r1', 'En Escena', 'inc-1');
    expect(alCambiar).toHaveBeenCalledOnce();
  });

  it('propaga errores al cambiar el estado', async () => {
    const { from } = clienteUpdate({ data: null, error: { message: 'denegado' } });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);

    await expect(servicio.cambiarEstadoRecurso('r1', 'Disponible', null)).rejects.toThrow('denegado');
  });

  it('una actualización que no toca ninguna fila (RLS) falla en vez de pasar en silencio', async () => {
    const { from } = clienteUpdate({ data: null, error: { code: 'PGRST116', message: 'JSON object requested' } });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);

    await expect(servicio.cambiarEstadoRecurso('r1', 'Disponible', null)).rejects.toThrow('rol de operador');
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
