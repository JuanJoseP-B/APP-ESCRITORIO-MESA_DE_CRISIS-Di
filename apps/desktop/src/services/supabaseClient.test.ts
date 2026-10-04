import { describe, expect, it, vi } from 'vitest';
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { aCambioRealtime, aSesion, crearServicioMesa } from './supabaseClient';

type Fila = Record<string, unknown>;

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

    await expect(servicio.listarReportes()).rejects.toThrow('reportes_ciudadanos');
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

  it('lista recursos desde recursos_operativos', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const from = vi.fn().mockReturnValue({ select });
    await crearServicioMesa({ from } as unknown as SupabaseClient).listarRecursos();
    expect(from).toHaveBeenCalledWith('recursos_operativos');
  });

  it('cambia el estado de un recurso con update().eq()', async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });
    const servicio = crearServicioMesa({ from } as unknown as SupabaseClient);

    await servicio.cambiarEstadoRecurso('r1', 'Despachado', 'inc-1');

    expect(from).toHaveBeenCalledWith('recursos_operativos');
    expect(update).toHaveBeenCalledWith({ estado_actual: 'Despachado', incidente_asignado_id: 'inc-1' });
    expect(eq).toHaveBeenCalledWith('id', 'r1');
  });

  it('propaga errores al cambiar el estado', async () => {
    const eq = vi.fn().mockResolvedValue({ error: { message: 'denegado' } });
    const servicio = crearServicioMesa({
      from: () => ({ update: () => ({ eq }) }),
    } as unknown as SupabaseClient);

    await expect(servicio.cambiarEstadoRecurso('r1', 'Disponible', null)).rejects.toThrow('denegado');
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
    ['actualizarEstadoReporte', 'reportes_ciudadanos', (s: ReturnType<typeof crearServicioMesa>) => s.actualizarEstadoReporte('i1', 'Confirmado'), { estado_validacion: 'Confirmado' }],
    ['actualizarOcupacionZona', 'zonas_publicas', (s: ReturnType<typeof crearServicioMesa>) => s.actualizarOcupacionZona('i1', 7), { capacidad_actual: 7 }],
  ])('%s hace update().eq("id")', async (_nombre, tabla, accion, cambios) => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const update = vi.fn().mockReturnValue({ eq });
    const from = vi.fn().mockReturnValue({ update });

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
