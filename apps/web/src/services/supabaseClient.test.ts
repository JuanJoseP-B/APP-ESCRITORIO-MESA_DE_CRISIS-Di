import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { ZonaRiesgo } from '@argos/shared';
import { aCambioZonaRiesgo, BUCKET_FOTOS, crearServicioPortal } from './supabaseClient';

const geometria = { type: 'Point', coordinates: [0, 0] } as const;

describe('crearServicioPortal', () => {
  it('lista zonas públicas desde zonas_publicas', async () => {
    const select = vi.fn().mockResolvedValue({ data: [{ id: 'z' }], error: null });
    const from = vi.fn().mockReturnValue({ select });
    const servicio = crearServicioPortal({ from } as unknown as SupabaseClient);

    await expect(servicio.listarZonasPublicas()).resolves.toEqual([{ id: 'z' }]);
    expect(from).toHaveBeenCalledWith('zonas_publicas');
  });

  it('lista zonas de riesgo con columnas públicas y sin incidentes resueltos', async () => {
    const neq = vi.fn().mockResolvedValue({ data: [], error: null });
    const select = vi.fn().mockReturnValue({ neq });
    const from = vi.fn().mockReturnValue({ select });
    await crearServicioPortal({ from } as unknown as SupabaseClient).listarZonasRiesgo();

    expect(from).toHaveBeenCalledWith('zonas_riesgo');
    expect(select).toHaveBeenCalledWith('id,titulo,nivel_criticidad,estado,geometria');
    expect(neq).toHaveBeenCalledWith('estado', 'Resuelto');
  });

  it('propaga errores de lectura', async () => {
    const select = vi.fn().mockResolvedValue({ data: null, error: { message: 'boom' } });
    const servicio = crearServicioPortal({ from: () => ({ select }) } as unknown as SupabaseClient);
    await expect(servicio.listarZonasPublicas()).rejects.toThrow('boom');
  });

  it('inserta el reporte como "No confirmado" sin foto', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ insert });
    const servicio = crearServicioPortal({ from } as unknown as SupabaseClient);

    await servicio.enviarReporte({ tipo: 'INCENDIO', lat: -33.4, lng: -70.6 });

    expect(from).toHaveBeenCalledWith('reportes_ciudadanos');
    expect(insert).toHaveBeenCalledWith({
      tipo: 'INCENDIO',
      lat: -33.4,
      lng: -70.6,
      imagen_url: null,
      estado_validacion: 'No confirmado',
    });
  });

  it('sube la foto al bucket y guarda su URL pública', async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const upload = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn().mockReturnValue({ data: { publicUrl: 'https://cdn/foto.png' } });
    const storageFrom = vi.fn().mockReturnValue({ upload, getPublicUrl });
    const client = { from: () => ({ insert }), storage: { from: storageFrom } };
    const foto = new File(['x'], 'f.png', { type: 'image/png' });

    await crearServicioPortal(client as unknown as SupabaseClient).enviarReporte(
      { tipo: 'VIA_BLOQUEADA', lat: 1, lng: 2 },
      foto,
    );

    expect(storageFrom).toHaveBeenCalledWith(BUCKET_FOTOS);
    expect(upload).toHaveBeenCalledWith(expect.stringMatching(/\.png$/), foto, { contentType: 'image/png' });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ imagen_url: 'https://cdn/foto.png' }));
  });

  it('no inserta el reporte si falla la subida de la foto', async () => {
    const insert = vi.fn();
    const upload = vi.fn().mockResolvedValue({ error: { message: 'sin espacio' } });
    const client = { from: () => ({ insert }), storage: { from: () => ({ upload }) } };
    const foto = new File(['x'], 'f.png', { type: 'image/png' });

    await expect(
      crearServicioPortal(client as unknown as SupabaseClient).enviarReporte(
        { tipo: 'FUGA_GAS', lat: 0, lng: 0 },
        foto,
      ),
    ).rejects.toThrow('sin espacio');
    expect(insert).not.toHaveBeenCalled();
  });

  it('nunca consulta recursos_operativos', async () => {
    const select = vi.fn().mockResolvedValue({ data: [], error: null });
    const neq = vi.fn().mockResolvedValue({ data: [], error: null });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const from = vi.fn().mockReturnValue({ select: select.mockReturnValue({ neq, then: undefined }), insert });
    const canal = { on: vi.fn(), subscribe: vi.fn() };
    canal.on.mockReturnValue(canal);
    canal.subscribe.mockReturnValue(canal);
    const client = { from, channel: vi.fn().mockReturnValue(canal), removeChannel: vi.fn() };
    const s = crearServicioPortal(client as unknown as SupabaseClient);

    await s.listarZonasPublicas();
    await s.listarZonasRiesgo();
    await s.enviarReporte({ tipo: 'FUGA_GAS', lat: 0, lng: 0 });
    s.suscribirZonasPublicas(vi.fn());
    s.suscribirZonasRiesgo(vi.fn());

    const tablas = [
      ...from.mock.calls.map((c) => c[0]),
      ...canal.on.mock.calls.map((c) => (c[1] as { table: string }).table),
    ];
    expect(tablas).not.toContain('recursos_operativos');
    expect(tablas).not.toContain('incidentes');
    expect(new Set(tablas)).toEqual(new Set(['zonas_publicas', 'zonas_riesgo', 'reportes_ciudadanos']));
  });
});

describe('aCambioZonaRiesgo', () => {
  const fila = {
    id: 'i1',
    titulo: 'Incendio',
    nivel_criticidad: 'Crítico',
    estado: 'Abierto',
    geometria,
    timeline: [{ timestamp: 'x', descripcion: 'dato táctico' }],
  } as unknown as ZonaRiesgo;

  it('descarta campos no públicos como el timeline', () => {
    const cambio = aCambioZonaRiesgo({ tipo: 'UPDATE', nuevo: fila, idEliminado: null });
    expect(cambio.nuevo).not.toHaveProperty('timeline');
    expect(cambio.nuevo).toEqual({
      id: 'i1',
      titulo: 'Incendio',
      nivel_criticidad: 'Crítico',
      estado: 'Abierto',
      geometria,
    });
  });

  it('trata un incidente resuelto como eliminado', () => {
    const resuelto = { ...fila, estado: 'Resuelto' } as ZonaRiesgo;
    expect(aCambioZonaRiesgo({ tipo: 'UPDATE', nuevo: resuelto, idEliminado: null })).toEqual({
      tipo: 'DELETE',
      nuevo: null,
      idEliminado: 'i1',
    });
  });

  it('deja pasar los DELETE tal cual', () => {
    const del = { tipo: 'DELETE', nuevo: null, idEliminado: 'i1' } as const;
    expect(aCambioZonaRiesgo(del)).toBe(del);
  });
});
