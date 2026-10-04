import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js';
import type { NuevoReporte, ZonaPublica, ZonaRiesgo } from '@argos/shared';
import type { CambioRealtime } from '../domain/realtime';

/**
 * Único punto de acceso a Supabase del portal. La UI consume esta interfaz
 * (vía hooks) y nunca el cliente. Solo toca `zonas_publicas`, `zonas_riesgo`
 * (espejo público de incidentes, sin `timeline`) y `reportes_ciudadanos` (INSERT); jamás `recursos_operativos`.
 */
export interface ServicioPortal {
  listarZonasPublicas(): Promise<readonly ZonaPublica[]>;
  listarZonasRiesgo(): Promise<readonly ZonaRiesgo[]>;
  /** Devuelven la función para cancelar la suscripción. */
  suscribirZonasPublicas(alCambiar: (cambio: CambioRealtime<ZonaPublica>) => void): () => void;
  suscribirZonasRiesgo(alCambiar: (cambio: CambioRealtime<ZonaRiesgo>) => void): () => void;
  enviarReporte(reporte: NuevoReporte, foto?: File | null): Promise<void>;
}

type Fila = Record<string, unknown>;

export const BUCKET_FOTOS = 'reportes';
const COLUMNAS_RIESGO = 'id,titulo,nivel_criticidad,estado,geometria';

export function aCambioRealtime<T extends { readonly id: string }>(
  payload: RealtimePostgresChangesPayload<Fila>,
): CambioRealtime<T> {
  if (payload.eventType === 'DELETE') {
    const id = payload.old['id'];
    return { tipo: 'DELETE', nuevo: null, idEliminado: typeof id === 'string' ? id : null };
  }
  return { tipo: payload.eventType, nuevo: payload.new as unknown as T, idEliminado: null };
}

/**
 * Realtime entrega la fila completa: se descartan los campos no públicos
 * (p. ej. `timeline`) y los incidentes resueltos se tratan como eliminados.
 */
export function aCambioZonaRiesgo(cambio: CambioRealtime<ZonaRiesgo>): CambioRealtime<ZonaRiesgo> {
  const fila = cambio.nuevo;
  if (!fila) return cambio;
  if (fila.estado === 'Resuelto') return { tipo: 'DELETE', nuevo: null, idEliminado: fila.id };
  const { id, titulo, nivel_criticidad, estado, geometria } = fila;
  return { ...cambio, nuevo: { id, titulo, nivel_criticidad, estado, geometria } };
}

function extensionDe(foto: File): string {
  const ext = foto.type.split('/')[1]?.replace(/[^a-z0-9]/gi, '');
  return ext && ext.length > 0 ? ext : 'jpg';
}

export function crearServicioPortal(client: SupabaseClient): ServicioPortal {
  const suscribir = <T extends { readonly id: string }>(
    tabla: string,
    alCambiar: (cambio: CambioRealtime<T>) => void,
  ): (() => void) => {
    const canal = client
      .channel(`portal-${tabla}`)
      .on<Fila>('postgres_changes', { event: '*', schema: 'public', table: tabla }, (payload) =>
        alCambiar(aCambioRealtime<T>(payload)),
      )
      .subscribe();
    return () => {
      void client.removeChannel(canal);
    };
  };

  return {
    async listarZonasPublicas() {
      const { data, error } = await client.from('zonas_publicas').select('*');
      if (error) throw new Error(`No se pudieron leer las zonas públicas: ${error.message}`);
      return (data ?? []) as ZonaPublica[];
    },
    async listarZonasRiesgo() {
      const { data, error } = await client
        .from('zonas_riesgo')
        .select(COLUMNAS_RIESGO)
        .neq('estado', 'Resuelto');
      if (error) throw new Error(`No se pudieron leer las zonas de riesgo: ${error.message}`);
      return (data ?? []) as ZonaRiesgo[];
    },
    suscribirZonasPublicas: (cb) => suscribir<ZonaPublica>('zonas_publicas', cb),
    suscribirZonasRiesgo: (cb) =>
      suscribir<ZonaRiesgo>('zonas_riesgo', (cambio) => cb(aCambioZonaRiesgo(cambio))),
    async enviarReporte(reporte, foto) {
      let imagenUrl: string | null = reporte.imagen_url ?? null;
      if (foto) {
        const ruta = `${crypto.randomUUID()}.${extensionDe(foto)}`;
        const { error: errorSubida } = await client.storage
          .from(BUCKET_FOTOS)
          .upload(ruta, foto, { contentType: foto.type });
        if (errorSubida) throw new Error(`No se pudo subir la foto: ${errorSubida.message}`);
        imagenUrl = client.storage.from(BUCKET_FOTOS).getPublicUrl(ruta).data.publicUrl;
      }
      const { error } = await client.from('reportes_ciudadanos').insert({
        tipo: reporte.tipo,
        lat: reporte.lat,
        lng: reporte.lng,
        imagen_url: imagenUrl,
        estado_validacion: 'No confirmado',
      });
      if (error) throw new Error(`No se pudo enviar el reporte: ${error.message}`);
    },
  };
}

/** Crea el servicio desde variables de entorno; `null` si no están configuradas. */
export function crearServicioDesdeEntorno(): ServicioPortal | null {
  const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
  if (!url || !key) return null;
  return crearServicioPortal(createClient(url, key));
}
