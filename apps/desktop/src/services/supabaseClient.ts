import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js';
import type {
  EstadoRecurso,
  EstadoValidacion,
  Incidente,
  NuevaZonaPublica,
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
  /**
   * Persiste el cambio de estado y devuelve la fila guardada; la validación de la transición la hace
   * quien llama (UI/dominio). Toda escritura se notifica además a los suscriptores locales, sin
   * esperar el eco de Realtime.
   */
  cambiarEstadoRecurso(id: string, estado: EstadoRecurso, incidenteId: string | null): Promise<Recurso>;
  crearIncidente(nuevo: NuevoIncidente): Promise<Incidente>;
  actualizarIncidente(id: string, cambios: CambiosIncidente): Promise<void>;
  actualizarEstadoReporte(id: string, estado: EstadoValidacion): Promise<void>;
  listarZonasPublicas(): Promise<readonly ZonaPublica[]>;
  suscribirZonasPublicas(alCambiar: (cambio: CambioRealtime<ZonaPublica>) => void): () => void;
  /** Guarda una figura trazada en el mapa (polígono o línea) como zona pública. */
  crearZonaPublica(nueva: NuevaZonaPublica): Promise<ZonaPublica>;
  /** Suma `delta` a `capacidad_actual` de forma atómica en la base (acotado entre 0 y la capacidad máxima). */
  ajustarOcupacionZona(id: string, delta: number): Promise<ZonaPublica>;
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

/** PostgREST responde PGRST116 cuando `.single()` no encuentra fila: RLS la ocultó o no existe. */
const describir = (error: { readonly message: string; readonly code?: string }): string =>
  error.code === 'PGRST116' ? 'la fila no existe o la sesión no tiene rol de operador' : error.message;

export function crearServicioMesa(client: SupabaseClient): ServicioMesa {
  type Oyente = (cambio: CambioRealtime<{ readonly id: string }>) => void;
  const oyentes = new Map<string, Set<Oyente>>();

  /** Entrega a la UI la fila recién escrita; el eco posterior de Realtime es idempotente. */
  const emitir = <T extends { readonly id: string }>(tabla: string, tipo: 'INSERT' | 'UPDATE', fila: T): T => {
    oyentes.get(tabla)?.forEach((cb) => cb({ tipo, nuevo: fila, idEliminado: null }));
    return fila;
  };

  const actualizar = async <T extends { readonly id: string }>(tabla: string, id: string, cambios: Fila): Promise<T> => {
    const { data, error } = await client.from(tabla).update(cambios).eq('id', id).select().single();
    if (error) throw new Error(`No se pudo actualizar ${tabla} ${id}: ${describir(error)}`);
    return emitir(tabla, 'UPDATE', data as T);
  };

  const insertar = async <T extends { readonly id: string }>(tabla: string, fila: Fila): Promise<T> => {
    const { data, error } = await client.from(tabla).insert(fila).select().single();
    if (error) throw new Error(`No se pudo crear en ${tabla}: ${describir(error)}`);
    return emitir(tabla, 'INSERT', data as T);
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
    const local = alCambiar as Oyente;
    const grupo = oyentes.get(tabla) ?? new Set<Oyente>();
    oyentes.set(tabla, grupo.add(local));
    const canal = client
      .channel(`mesa-${tabla}`)
      .on<Fila>('postgres_changes', { event: '*', schema: 'public', table: tabla }, (payload) =>
        alCambiar(aCambioRealtime<T>(payload)),
      )
      .subscribe();
    return () => {
      grupo.delete(local);
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
    cambiarEstadoRecurso: (id, estado, incidenteId) =>
      actualizar<Recurso>('recursos_operativos', id, { estado_actual: estado, incidente_asignado_id: incidenteId }),
    crearIncidente: (nuevo) => insertar<Incidente>('incidentes', { ...nuevo }),
    actualizarIncidente: async (id, cambios) => {
      await actualizar<Incidente>('incidentes', id, { ...cambios });
    },
    actualizarEstadoReporte: async (id, estado) => {
      await actualizar<Reporte>('reportes_ciudadanos', id, { estado_validacion: estado });
    },
    listarZonasPublicas: () => listar<ZonaPublica>('zonas_publicas'),
    suscribirZonasPublicas: (cb) => suscribir<ZonaPublica>('zonas_publicas', cb),
    crearZonaPublica: (nueva) => insertar<ZonaPublica>('zonas_publicas', { ...nueva }),
    ajustarOcupacionZona: async (id, delta) => {
      // RPC de migrations/0004: un único UPDATE relativo, sin leer-y-escribir desde el cliente.
      const { data, error } = await client.rpc('ajustar_ocupacion_zona', { p_id: id, p_delta: delta }).single();
      if (error) throw new Error(`No se pudo ajustar la ocupación de ${id}: ${describir(error)}`);
      return emitir('zonas_publicas', 'UPDATE', data as ZonaPublica);
    },
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
