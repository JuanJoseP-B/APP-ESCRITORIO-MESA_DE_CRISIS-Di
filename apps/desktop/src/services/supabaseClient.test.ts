import { describe, expect, it, vi } from 'vitest';
import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import { aCambioRealtime, crearServicioMesa } from './supabaseClient';

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
});
