import {
  ajustarOcupacion,
  transicionarRecurso,
  type Coordenadas,
  type EventoRecurso,
  type EventoTimeline,
  type Incidente,
  type Llamada,
  type Recurso,
  type Reporte,
  type ZonaPublica,
} from '@argos/shared';
import type { CambioRealtime } from '../domain/realtime';
import { ubicacionDeIncidente } from '../domain/geo';
import type { ServicioMesa } from './supabaseClient';

const hace = (ahoraMs: number, min: number): string => new Date(ahoraMs - min * 60_000).toISOString();

/** Un incidente en curso, el mismo del `seed.sql` (Pasto, Nariño). Las horas se refieren a la del servicio. */
function incidentesIniciales(ahoraMs: number): readonly Incidente[] {
  return [
    {
      id: 'demo-1',
      titulo: 'Fuga de gas en sector',
      nivel_criticidad: 'Crítico',
      prioridad: 'P1',
      tipo: 'FUGA_GAS',
      estado: 'Abierto',
      geometria: { type: 'Point', coordinates: [-77.2811, 1.2136] },
      timeline: [
        { timestamp: hace(ahoraMs, 9), creado_en: hace(ahoraMs, 9), descripcion: 'Incidente registrado' },
        { timestamp: hace(ahoraMs, 7), creado_en: hace(ahoraMs, 7), descripcion: 'Validado por operador' },
      ],
      creado_en: hace(ahoraMs, 9),
    },
  ];
}

const OPERADOR_DEMO = 'demo-op';

function llamadasIniciales(ahoraMs: number): readonly Llamada[] {
  return [
    {
      id: 'demo-r1',
      canal: 'VHF',
      tipo: 'INCENDIO',
      prioridad: 'P2',
      ubicacion: { lat: 1.2162, lng: -77.2798 },
      narrativa: 'Humo visible desde una bodega, sin confirmar.',
      reportante: null,
      callback: null,
      incidenteId: null,
      estadoValidacion: 'No confirmado',
      operadorId: OPERADOR_DEMO,
      creadoEn: hace(ahoraMs, 2),
    },
  ];
}

/** Vista de una llamada con la forma de `Reporte`, mientras la bandeja siga consumiendo ese tipo. */
const aReporte = (l: Llamada): Reporte => ({
  id: l.id,
  tipo: l.tipo,
  lat: l.ubicacion.lat,
  lng: l.ubicacion.lng,
  imagen_url: null,
  estado_validacion: l.estadoValidacion,
  creado_en: l.creadoEn,
});

const unidad = (
  n: number,
  etiqueta: string,
  tipo: Recurso['tipo'],
  estado: Recurso['estado_actual'],
  base: Coordenadas,
  incidenteId: string | null = null,
  ubicacion: Coordenadas = base,
): Recurso => ({ id: `demo-rec-${n}`, etiqueta, tipo, estado_actual: estado, incidente_asignado_id: incidenteId, base, ubicacion });

/** Mismas unidades y bases que el `seed.sql` (más la M12); la M11 ya está en la escena del incidente. */
const recursosIniciales: readonly Recurso[] = [
  unidad(1, 'U01', 'Bomberos', 'DISPONIBLE', { lat: 1.2142, lng: -77.279 }),
  unidad(2, 'U02', 'Bomberos', 'ASIGNADO', { lat: 1.2105, lng: -77.2838 }, 'demo-1'),
  unidad(3, 'M11', 'Ambulancia', 'EN_ESCENA', { lat: 1.2168, lng: -77.2815 }, 'demo-1', { lat: 1.2136, lng: -77.2811 }),
  unidad(4, 'P01', 'Policía', 'DISPONIBLE', { lat: 1.2128, lng: -77.2805 }),
  unidad(5, 'M10', 'Ambulancia', 'INOPERATIVO', { lat: 1.212, lng: -77.276 }),
  unidad(6, 'M12', 'Ambulancia', 'DISPONIBLE', { lat: 1.2184, lng: -77.2778 }),
];

/** Historia de los recursos que arrancan ocupados, referida a la hora del servicio para que sus SLA tengan sentido. */
function eventosIniciales(ahoraMs: number): readonly EventoRecurso[] {
  const evento = (
    n: number,
    recursoId: string,
    desde: EventoRecurso['desde'],
    hacia: EventoRecurso['hacia'],
    min: number,
  ): EventoRecurso => ({ id: `demo-ev${n}`, recursoId, incidenteId: 'demo-1', desde, hacia, origen: 'MANUAL', creadoEn: hace(ahoraMs, min) });
  return [
    evento(1, 'demo-rec-3', 'DISPONIBLE', 'ASIGNADO', 7),
    evento(2, 'demo-rec-3', 'ASIGNADO', 'EN_RUTA', 6),
    evento(3, 'demo-rec-3', 'EN_RUTA', 'EN_ESCENA', 3),
    evento(4, 'demo-rec-2', 'DISPONIBLE', 'ASIGNADO', 1),
  ];
}

const zonasIniciales: readonly ZonaPublica[] = [
  {
    id: 'demo-z1',
    tipo: 'Refugio',
    nombre: 'Coliseo Municipal',
    geometria: { type: 'Point', coordinates: [-77.283, 1.215] },
    capacidad_actual: 45,
    capacidad_maxima: 200,
  },
  {
    id: 'demo-z2',
    tipo: 'Refugio',
    nombre: 'Colegio Central',
    geometria: { type: 'Point', coordinates: [-77.279, 1.211] },
    capacidad_actual: 10,
    capacidad_maxima: 120,
  },
];

/** Tabla en memoria que notifica a sus suscriptores como lo haría Realtime. */
function crearTabla<T extends { readonly id: string }>(inicial: readonly T[]) {
  let filas = inicial;
  const oyentes = new Set<(cambio: CambioRealtime<T>) => void>();
  return {
    listar: (): Promise<readonly T[]> => Promise.resolve(filas),
    obtener(id: string): T {
      const fila = filas.find((f) => f.id === id);
      if (!fila) throw new Error(`Fila ${id} no existe`);
      return fila;
    },
    suscribir: (cb: (cambio: CambioRealtime<T>) => void): (() => void) => {
      oyentes.add(cb);
      return () => void oyentes.delete(cb);
    },
    insertar(fila: T): void {
      filas = [...filas, fila];
      oyentes.forEach((cb) => cb({ tipo: 'INSERT', nuevo: fila, idEliminado: null }));
    },
    /** `cambios` puede derivarse de la fila vigente (actualización relativa). */
    actualizar(id: string, cambios: Partial<T> | ((actual: T) => Partial<T>)): T {
      const actual = filas.find((f) => f.id === id);
      if (!actual) throw new Error(`Fila ${id} no existe`);
      const nuevo = { ...actual, ...(typeof cambios === 'function' ? cambios(actual) : cambios) };
      filas = filas.map((f) => (f.id === id ? nuevo : f));
      oyentes.forEach((cb) => cb({ tipo: 'UPDATE', nuevo, idEliminado: null }));
      return nuevo;
    },
  };
}

export interface OpcionesDemo {
  /** Reloj del "servidor" simulado (ms epoch); por defecto el del equipo. */
  readonly ahora?: () => number;
}

/** Datos locales de ejemplo para desarrollar la UI sin backend; no hace consultas de red. */
export function crearServicioDemo({ ahora = Date.now }: OpcionesDemo = {}): ServicioMesa {
  const tIncidentes = crearTabla<Incidente>(incidentesIniciales(ahora()));
  const tLlamadas = crearTabla<Llamada>(llamadasIniciales(ahora()));
  const tRecursos = crearTabla<Recurso>(recursosIniciales);
  const tEventos = crearTabla<EventoRecurso>(eventosIniciales(ahora()));
  const tZonas = crearTabla<ZonaPublica>(zonasIniciales);
  let contador = 0;
  let eventos = 0;
  const sesion = { email: 'demo@local', esOperador: true };
  const iso = (): string => new Date(ahora()).toISOString();
  const envolver = <R>(f: () => R): Promise<R> => {
    try {
      return Promise.resolve(f());
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error('Error desconocido'));
    }
  };
  /** Igual que el trigger de la 0006: sella solo los eventos sin `creado_en`. */
  const sellar = (timeline: readonly EventoTimeline[]): readonly EventoTimeline[] =>
    timeline.map((e) => (e.creado_en ? e : { ...e, creado_en: iso() }));

  const cambiarEstadoRecurso: ServicioMesa['cambiarEstadoRecurso'] = (id, estado, incidenteId, origen = 'MANUAL') =>
    envolver(() => {
      const actual = tRecursos.obtener(id);
      const destino = estado === 'ASIGNADO' ? incidenteId : actual.incidente_asignado_id;
      const incidente = estado === 'EN_ESCENA' && destino ? tIncidentes.obtener(destino) : null;
      const siguiente = transicionarRecurso(
        actual,
        estado,
        incidenteId ?? undefined,
        incidente ? ubicacionDeIncidente(incidente) : null,
      );
      const guardado = tRecursos.actualizar(id, siguiente);
      tEventos.insertar({
        id: `demo-ev-${++eventos}`,
        recursoId: id,
        incidenteId: siguiente.incidente_asignado_id ?? actual.incidente_asignado_id,
        desde: actual.estado_actual,
        hacia: estado,
        origen,
        creadoEn: iso(),
      });
      return guardado;
    });

  const vincularLlamada: ServicioMesa['vincularLlamada'] = (id, incidenteId) =>
    envolver(() => tLlamadas.actualizar(id, { incidenteId, estadoValidacion: 'Confirmado' }));

  return {
    listarIncidentes: tIncidentes.listar,
    listarReportes: () => tLlamadas.listar().then((ls) => ls.map(aReporte)),
    suscribirIncidentes: tIncidentes.suscribir,
    suscribirReportes: (cb) =>
      tLlamadas.suscribir((c) => cb({ ...c, nuevo: c.nuevo ? aReporte(c.nuevo) : null })),
    listarLlamadas: tLlamadas.listar,
    suscribirLlamadas: tLlamadas.suscribir,
    registrarLlamada: (nueva, incidenteId = null) =>
      envolver(() => {
        const llamada: Llamada = {
          ...nueva,
          id: `demo-l${++contador}`,
          incidenteId,
          estadoValidacion: incidenteId ? 'Confirmado' : 'No confirmado',
          operadorId: OPERADOR_DEMO,
          creadoEn: iso(),
        };
        tLlamadas.insertar(llamada);
        return llamada;
      }),
    vincularLlamada,
    descartarLlamada: (id) => envolver(() => void tLlamadas.actualizar(id, { estadoValidacion: 'Descartado' })),
    listarRecursos: tRecursos.listar,
    suscribirRecursos: tRecursos.suscribir,
    listarEventosRecurso: tEventos.listar,
    suscribirEventosRecurso: tEventos.suscribir,
    cambiarEstadoRecurso,
    actualizarUbicacionRecurso: (id, ubicacion) => envolver(() => tRecursos.actualizar(id, { ubicacion })),
    crearIncidente: (nuevo) => {
      const incidente: Incidente = { ...nuevo, id: `demo-i${++contador}`, timeline: sellar(nuevo.timeline), creado_en: iso() };
      tIncidentes.insertar(incidente);
      return Promise.resolve(incidente);
    },
    actualizarIncidente: (id, cambios) =>
      envolver(
        () => void tIncidentes.actualizar(id, cambios.timeline ? { ...cambios, timeline: sellar(cambios.timeline) } : cambios),
      ),
    actualizarEstadoReporte: (id, estado) => envolver(() => void tLlamadas.actualizar(id, { estadoValidacion: estado })),
    listarZonasPublicas: tZonas.listar,
    suscribirZonasPublicas: tZonas.suscribir,
    crearZonaPublica: (nueva) => {
      const zona: ZonaPublica = { ...nueva, id: `demo-zt${++contador}` };
      tZonas.insertar(zona);
      return Promise.resolve(zona);
    },
    ajustarOcupacionZona: (id, delta) =>
      envolver(() => tZonas.actualizar(id, (z) => ({ capacidad_actual: ajustarOcupacion(z, delta) }))),
    iniciarSesion: () => Promise.resolve(sesion),
    cerrarSesion: () => Promise.resolve(),
    sesionActual: () => Promise.resolve(sesion),
    desfaseHoraServidorMs: () => Promise.resolve(0),
  };
}

export const servicioDemo: ServicioMesa = crearServicioDemo();
