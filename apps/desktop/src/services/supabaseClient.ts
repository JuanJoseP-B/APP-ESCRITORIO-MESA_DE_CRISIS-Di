import { createClient, type RealtimePostgresChangesPayload, type SupabaseClient } from '@supabase/supabase-js';
import type {
  Coordenadas,
  EstadoRecurso,
  EstadoValidacion,
  EventoRecurso,
  Incidente,
  Llamada,
  NuevaLlamada,
  NuevaZonaPublica,
  NuevoIncidente,
  OrigenEventoRecurso,
  Recurso,
  Reporte,
  ZonaPublica,
} from '@argos/shared';
import { calcularDesfaseMs } from '../domain/reloj';
import type { CambioRealtime } from '../domain/realtime';
import { aEventoRecurso, aFilaLlamada, aLlamada, type Fila } from './filas';

export interface SesionOperador {
  readonly email: string;
  /** `true` solo si el JWT trae `app_metadata.rol === 'operador'`. */
  readonly esOperador: boolean;
}

/** Campos de un incidente que el operador puede modificar. */
export type CambiosIncidente = Partial<
  Pick<
    Incidente,
    'estado' | 'geometria' | 'timeline' | 'nivel_criticidad' | 'titulo' | 'prioridad' | 'tipo' | 'perimetro' | 'perimetro_origen'
  >
>;

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
  /** Llamadas registradas por el operador (tabla `llamadas`), ya convertidas a `Llamada`. */
  listarLlamadas(): Promise<readonly Llamada[]>;
  suscribirLlamadas(alCambiar: (cambio: CambioRealtime<Llamada>) => void): () => void;
  /** Registra una llamada nueva; con `incidenteId` nace vinculada a ese incidente. */
  registrarLlamada(nueva: NuevaLlamada, incidenteId?: string | null): Promise<Llamada>;
  /** Asocia una llamada existente a un incidente y la da por confirmada. */
  vincularLlamada(id: string, incidenteId: string): Promise<Llamada>;
  descartarLlamada(id: string): Promise<void>;
  /** Transiciones de recursos con hora del servidor (base del cálculo de SLA). */
  listarEventosRecurso(): Promise<readonly EventoRecurso[]>;
  suscribirEventosRecurso(alCambiar: (cambio: CambioRealtime<EventoRecurso>) => void): () => void;
  /**
   * Transición atómica (RPC `transicionar_recurso`, 0006): cambia el estado, el incidente y la ubicación e
   * inserta el evento con la hora del servidor. La base rechaza las transiciones inválidas. Devuelve la fila
   * guardada y la notifica, junto con su evento, a los suscriptores locales sin esperar a Realtime.
   */
  cambiarEstadoRecurso(
    id: string,
    estado: EstadoRecurso,
    incidenteId: string | null,
    origen?: OrigenEventoRecurso,
  ): Promise<Recurso>;
  /** Corrige a mano la posición de una unidad (no genera evento). */
  actualizarUbicacionRecurso(id: string, ubicacion: Coordenadas): Promise<Recurso>;
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
  /**
   * Desfase (ms) servidor − local para corregir el reloj de la consola. Nunca rechaza: si no se puede
   * medir, devuelve 0 y el reloj usa la hora del equipo.
   */
  desfaseHoraServidorMs(): Promise<number>;
}

/** Convierte una fila de la base en el tipo de dominio; por defecto la fila ya tiene su forma. */
type Mapeo<T> = (fila: Fila) => T;
const tal = <T>(fila: Fila): T => fila as unknown as T;

export function aCambioRealtime<T extends { readonly id: string }>(
  payload: RealtimePostgresChangesPayload<Fila>,
  mapear: Mapeo<T> = tal,
): CambioRealtime<T> {
  if (payload.eventType === 'DELETE') {
    const id = payload.old['id'];
    return { tipo: 'DELETE', nuevo: null, idEliminado: typeof id === 'string' ? id : null };
  }
  return { tipo: payload.eventType, nuevo: mapear(payload.new), idEliminado: null };
}

export function aSesion(email: string | undefined, appMetadata: Record<string, unknown> | undefined): SesionOperador {
  return { email: email ?? '', esOperador: appMetadata?.['rol'] === 'operador' };
}

/** PostgREST responde PGRST116 cuando `.single()` no encuentra fila: RLS la ocultó o no existe. */
const describir = (error: { readonly message: string; readonly code?: string }): string =>
  error.code === 'PGRST116' ? 'la fila no existe o la sesión no tiene rol de operador' : error.message;

export function crearServicioMesa(
  client: SupabaseClient,
  medirDesfase: () => Promise<number> = () => Promise.resolve(0),
): ServicioMesa {
  type Oyente = (cambio: CambioRealtime<{ readonly id: string }>) => void;
  const oyentes = new Map<string, Set<Oyente>>();

  /** Entrega a la UI la fila recién escrita; el eco posterior de Realtime es idempotente. */
  const emitir = <T extends { readonly id: string }>(tabla: string, tipo: 'INSERT' | 'UPDATE', fila: T): T => {
    oyentes.get(tabla)?.forEach((cb) => cb({ tipo, nuevo: fila, idEliminado: null }));
    return fila;
  };

  const actualizar = async <T extends { readonly id: string }>(
    tabla: string,
    id: string,
    cambios: Fila,
    mapear: Mapeo<T> = tal,
  ): Promise<T> => {
    const { data, error } = await client.from(tabla).update(cambios).eq('id', id).select().single();
    if (error) throw new Error(`No se pudo actualizar ${tabla} ${id}: ${describir(error)}`);
    return emitir(tabla, 'UPDATE', mapear(data as Fila));
  };

  const insertar = async <T extends { readonly id: string }>(
    tabla: string,
    fila: Fila,
    mapear: Mapeo<T> = tal,
  ): Promise<T> => {
    const { data, error } = await client.from(tabla).insert(fila).select().single();
    if (error) throw new Error(`No se pudo crear en ${tabla}: ${describir(error)}`);
    return emitir(tabla, 'INSERT', mapear(data as Fila));
  };

  const listar = async <T>(tabla: string, mapear: Mapeo<T> = tal): Promise<readonly T[]> => {
    const { data, error } = await client.from(tabla).select('*');
    if (error) throw new Error(`No se pudo leer ${tabla}: ${error.message}`);
    return ((data ?? []) as Fila[]).map(mapear);
  };

  const suscribir = <T extends { readonly id: string }>(
    tabla: string,
    alCambiar: (cambio: CambioRealtime<T>) => void,
    mapear: Mapeo<T> = tal,
  ): (() => void) => {
    const local = alCambiar as Oyente;
    const grupo = oyentes.get(tabla) ?? new Set<Oyente>();
    oyentes.set(tabla, grupo.add(local));
    const canal = client
      .channel(`mesa-${tabla}`)
      .on<Fila>('postgres_changes', { event: '*', schema: 'public', table: tabla }, (payload) =>
        alCambiar(aCambioRealtime<T>(payload, mapear)),
      )
      .subscribe();
    return () => {
      grupo.delete(local);
      void client.removeChannel(canal);
    };
  };

  /** Entrega el evento que acaba de insertar la RPC sin esperar el eco de Realtime (que es idempotente). */
  const emitirUltimoEvento = async (recursoId: string): Promise<void> => {
    try {
      const { data } = await client
        .from('eventos_recurso')
        .select('*')
        .eq('recurso_id', recursoId)
        .order('creado_en', { ascending: false })
        .limit(1);
      const fila = (data as Fila[] | null)?.[0];
      if (fila) emitir('eventos_recurso', 'INSERT', aEventoRecurso(fila));
    } catch {
      // Solo agiliza la interfaz: si falla, el evento llega por Realtime.
    }
  };

  return {
    listarIncidentes: () => listar<Incidente>('incidentes'),
    listarReportes: () => listar<Reporte>('llamadas'),
    suscribirIncidentes: (cb) => suscribir<Incidente>('incidentes', cb),
    suscribirReportes: (cb) => suscribir<Reporte>('llamadas', cb),
    listarRecursos: () => listar<Recurso>('recursos_operativos'),
    suscribirRecursos: (cb) => suscribir<Recurso>('recursos_operativos', cb),
    listarLlamadas: () => listar<Llamada>('llamadas', aLlamada),
    suscribirLlamadas: (cb) => suscribir<Llamada>('llamadas', cb, aLlamada),
    registrarLlamada: (nueva, incidenteId = null) => insertar<Llamada>('llamadas', aFilaLlamada(nueva, incidenteId), aLlamada),
    vincularLlamada: (id, incidenteId) =>
      actualizar<Llamada>('llamadas', id, { incidente_id: incidenteId, estado_validacion: 'Confirmado' }, aLlamada),
    descartarLlamada: async (id) => {
      await actualizar<Llamada>('llamadas', id, { estado_validacion: 'Descartado' }, aLlamada);
    },
    listarEventosRecurso: () => listar<EventoRecurso>('eventos_recurso', aEventoRecurso),
    suscribirEventosRecurso: (cb) => suscribir<EventoRecurso>('eventos_recurso', cb, aEventoRecurso),
    cambiarEstadoRecurso: async (id, estado, incidenteId, origen = 'MANUAL') => {
      // RPC de migrations/0006: estado, incidente, ubicación y evento en una sola transacción.
      const { data, error } = await client
        .rpc('transicionar_recurso', { p_id: id, p_hacia: estado, p_incidente: incidenteId, p_origen: origen })
        .single();
      if (error) throw new Error(`No se pudo cambiar el estado de ${id}: ${describir(error)}`);
      const recurso = emitir('recursos_operativos', 'UPDATE', data as Recurso);
      await emitirUltimoEvento(id);
      return recurso;
    },
    actualizarUbicacionRecurso: (id, ubicacion) => actualizar<Recurso>('recursos_operativos', id, { ubicacion }),
    crearIncidente: (nuevo) => insertar<Incidente>('incidentes', { ...nuevo }),
    actualizarIncidente: async (id, cambios) => {
      await actualizar<Incidente>('incidentes', id, { ...cambios });
    },
    actualizarEstadoReporte: async (id, estado) => {
      await actualizar<Reporte>('llamadas', id, { estado_validacion: estado });
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
    desfaseHoraServidorMs: medirDesfase,
  };
}

const MUESTRAS_HORA = 3;

/**
 * Mide el desfase (ms) servidor − local con la RPC `hora_servidor` (0006). Toma `MUESTRAS_HORA` muestras y se
 * queda con la de menor viaje de ida y vuelta, que es la menos distorsionada: asume que el servidor respondió a
 * mitad del viaje. Si la RPC falla (sin red, base sin la 0006, sin rol), devuelve 0 y la consola usa la hora
 * del equipo.
 */
export async function medirDesfaseServidor(
  client: Pick<SupabaseClient, 'rpc'>,
  ahora: () => number = Date.now,
): Promise<number> {
  let mejor: { readonly viaje: number; readonly desfase: number } | null = null;
  for (let n = 0; n < MUESTRAS_HORA; n++) {
    try {
      const envio = ahora();
      const { data, error } = await client.rpc('hora_servidor');
      const recepcion = ahora();
      const servidor = error || typeof data !== 'string' ? Number.NaN : Date.parse(data);
      if (Number.isNaN(servidor)) continue;
      const viaje = recepcion - envio;
      if (mejor === null || viaje < mejor.viaje) mejor = { viaje, desfase: calcularDesfaseMs(servidor, envio, recepcion) };
    } catch {
      // Una muestra fallida no invalida las demás.
    }
  }
  return mejor?.desfase ?? 0;
}

/** Crea el servicio desde variables de entorno; `null` si no están configuradas. */
export function crearServicioDesdeEntorno(): ServicioMesa | null {
  const url = import.meta.env['VITE_SUPABASE_URL'] as string | undefined;
  const key = import.meta.env['VITE_SUPABASE_ANON_KEY'] as string | undefined;
  if (!url || !key) return null;
  const client = createClient(url, key);
  return crearServicioMesa(client, () => medirDesfaseServidor(client));
}
