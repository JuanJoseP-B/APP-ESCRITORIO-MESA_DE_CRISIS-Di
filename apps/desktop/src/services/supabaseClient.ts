import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js';
import type { Incidente, Reporte } from '@argos/shared';
import type { CambioRealtime } from '../domain/realtime';

/**
 * Único punto de acceso a Supabase. Los componentes de UI consumen
 * esta interfaz (vía hooks) y nunca el cliente directamente.
 */
export interface ServicioMesa {
  listarIncidentes(): Promise<readonly Incidente[]>;
  listarReportes(): Promise<readonly Reporte[]>;
  /** Devuelve la función para cancelar la suscripción. */
  suscribirIncidentes(alCambiar: (cambio: CambioRealtime<Incidente>) => void): () => void;
  suscribirReportes(alCambiar: (cambio: CambioRealtime<Reporte>) => void): () => void;
}

type Fila = Record<string, unknown>;

export function aCambioRealtime<T extends { readonly id: string }>(
  payload: RealtimePostgresChangesPayload<Fila>,
): CambioRealtime<T> {
  if (payload.eventType === 'DELETE') {
    const id = payload.old['id'];
    return { tipo: 'DELETE', nuevo: null, idEliminado: typeof id === 'string' ? id : null };
  }
  return { tipo: payload.eventType, nuevo: payload.new as unknown as T, idEliminado: null };
}

export function crearServicioMesa(client: SupabaseClient): ServicioMesa {
  const listar = async <T>(tabla: string): Promise<readonly T[]> => {
    const { data, error } = await client.from(tabla).select('*');
    if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
    return (data ?? []) as T[];
  };

  const suscribir = <T extends { readonly id: string }>(
    tabla: string,
    alCambiar: (cambio: CambioRealtime<T>) => void,
  ): (() => void) => {
    const canal = client
      .channel(`mesa-${tabla}`)
      .on<Fila>('postgres_changes', { event: '*', schema: 'public', table: tabla }, (payload) =>
        alCambiar(aCambioRealtime<T>(payload)),
      )
      .subscribe();
    return () => {
      void client.removeChannel(canal);
    };
  };

  return {
    listarIncidentes: () => listar<Incidente>('incidentes'),
    listarReportes: () => listar<Reporte>('reportes_ciudadanos'),
    suscribirIncidentes: (cb) => suscribir<Incidente>('incidentes', cb),
    suscribirReportes: (cb) => suscribir<Reporte>('reportes_ciudadanos', cb),
  };
}

/** Crea el servicio desde variables de entorno; `null` si no están configuradas. */
export function crearServicioDesdeEntorno(): ServicioMesa | null {
  const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
  if (!url || !key) return null;
  return crearServicioMesa(createClient(url, key));
}
