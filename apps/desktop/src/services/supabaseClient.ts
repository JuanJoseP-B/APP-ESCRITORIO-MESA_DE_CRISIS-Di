import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js';
import type {
  EstadoRecurso,
  EstadoValidacion,
  Incidente,
  NuevoIncidente,
  Recurso,
  Reporte,
  ZonaPublica,
} from '@argos/shared';
import type { CambioRealtime } from '../domain/realtime';

export interface SesionOperador {
  readonly email: string;
  /** `true` solo si el JWT trae `app_metadata.rol === 'operador'`. */
  readonly esOperador: boolean;
}

/** Campos de un incidente que el operador puede modificar. */
export type CambiosIncidente = Partial<Pick<Incidente, 'estado' | 'geometria' | 'timeline' | 'nivel_criticidad' | 'titulo'>>;

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
  listarRecursos(): Promise<readonly Recurso[]>;
  suscribirRecursos(alCambiar: (cambio: CambioRealtime<Recurso>) => void): () => void;
  /** Persiste el cambio de estado; la validación de la transición la hace quien llama (UI/dominio). */
  cambiarEstadoRecurso(id: string, estado: EstadoRecurso, incidenteId: string | null): Promise<void>;
  crearIncidente(nuevo: NuevoIncidente): Promise<Incidente>;
  actualizarIncidente(id: string, cambios: CambiosIncidente): Promise<void>;
  actualizarEstadoReporte(id: string, estado: EstadoValidacion): Promise<void>;
  listarZonasPublicas(): Promise<readonly ZonaPublica[]>;
  suscribirZonasPublicas(alCambiar: (cambio: CambioRealtime<ZonaPublica>) => void): () => void;
  actualizarOcupacionZona(id: string, capacidadActual: number): Promise<void>;
  /** Autenticación email/contraseña (sin OAuth). */
  iniciarSesion(email: string, password: string): Promise<SesionOperador>;
  cerrarSesion(): Promise<void>;
  sesionActual(): Promise<SesionOperador | null>;
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

export function aSesion(email: string | undefined, appMetadata: Record<string, unknown> | undefined): SesionOperador {
  return { email: email ?? '', esOperador: appMetadata?.['rol'] === 'operador' };
}

export function crearServicioMesa(client: SupabaseClient): ServicioMesa {
  const actualizar = async (tabla: string, id: string, cambios: Fila): Promise<void> => {
    const { error } = await client.from(tabla).update(cambios).eq('id', id);
    if (error) throw new Error(`No se pudo actualizar ${tabla} ${id}: ${error.message}`);
  };

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
    listarRecursos: () => listar<Recurso>('recursos_operativos'),
    suscribirRecursos: (cb) => suscribir<Recurso>('recursos_operativos', cb),
    cambiarEstadoRecurso: async (id, estado, incidenteId) => {
      const { error } = await client
        .from('recursos_operativos')
        .update({ estado_actual: estado, incidente_asignado_id: incidenteId })
        .eq('id', id);
      if (error) throw new Error(`No se pudo actualizar el recurso ${id}: ${error.message}`);
    },
    crearIncidente: async (nuevo) => {
      const { data, error } = await client.from('incidentes').insert(nuevo).select().single();
      if (error) throw new Error(`No se pudo crear el incidente: ${error.message}`);
      return data as Incidente;
    },
    actualizarIncidente: (id, cambios) => actualizar('incidentes', id, { ...cambios }),
    actualizarEstadoReporte: (id, estado) => actualizar('reportes_ciudadanos', id, { estado_validacion: estado }),
    listarZonasPublicas: () => listar<ZonaPublica>('zonas_publicas'),
    suscribirZonasPublicas: (cb) => suscribir<ZonaPublica>('zonas_publicas', cb),
    actualizarOcupacionZona: (id, capacidadActual) => actualizar('zonas_publicas', id, { capacidad_actual: capacidadActual }),
    iniciarSesion: async (email, password) => {
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(`No se pudo iniciar sesión: ${error.message}`);
      return aSesion(data.user.email, data.user.app_metadata);
    },
    cerrarSesion: async () => {
      const { error } = await client.auth.signOut();
      if (error) throw new Error(`No se pudo cerrar sesión: ${error.message}`);
    },
    sesionActual: async () => {
      const { data } = await client.auth.getSession();
      const user = data.session?.user;
      return user ? aSesion(user.email, user.app_metadata) : null;
    },
  };
}

/** Crea el servicio desde variables de entorno; `null` si no están configuradas. */
export function crearServicioDesdeEntorno(): ServicioMesa | null {
  const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
  if (!url || !key) return null;
  return crearServicioMesa(createClient(url, key));
}
