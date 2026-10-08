import {
  ajustarOcupacion,
  transicionarRecurso,
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

const incidentes: readonly Incidente[] = [
  {
    id: 'demo-1',
    titulo: 'Incendio forestal cerro San Cristóbal',
    nivel_criticidad: 'Crítico',
    prioridad: 'P1',
    tipo: 'INCENDIO',
    estado: 'Abierto',
    geometria: {
      type: 'Polygon',
      coordinates: [
        [
          [-70.64, -33.42],
          [-70.62, -33.42],
          [-70.62, -33.4],
          [-70.64, -33.4],
          [-70.64, -33.42],
        ],
      ],
    },
    timeline: [
      { timestamp: '2026-10-02T08:05:00Z', descripcion: 'Reporte ciudadano recibido' },
      { timestamp: '2026-10-02T08:12:00Z', descripcion: 'Validado por operador' },
    ],
  },
  {
    id: 'demo-2',
    titulo: 'Bloqueo de vía Av. Providencia',
    nivel_criticidad: 'Medio',
    prioridad: 'P2',
    tipo: 'VIA_BLOQUEADA',
    estado: 'Contenido',
    geometria: { type: 'Point', coordinates: [-70.61, -33.43] },
    timeline: [{ timestamp: '2026-10-02T07:40:00Z', descripcion: 'Corte de tránsito' }],
  },
];

const OPERADOR_DEMO = 'demo-op';

const llamadasIniciales: readonly Llamada[] = [
  {
    id: 'demo-r1',
    canal: '123',
    tipo: 'INCENDIO',
    prioridad: 'P2',
    ubicacion: { lat: -33.45, lng: -70.66 },
    narrativa: 'Humo visible desde una bodega, sin confirmar.',
    reportante: null,
    callback: null,
    incidenteId: null,
    estadoValidacion: 'No confirmado',
    operadorId: OPERADOR_DEMO,
    creadoEn: '2026-10-02T08:20:00Z',
  },
];

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

/** Posiciones de ejemplo alrededor del incidente `demo-1` (Santiago, como el resto del demo). */
const recursosIniciales: readonly Recurso[] = [
  {
    id: 'demo-rec-1',
    tipo: 'Bomberos',
    estado_actual: 'DISPONIBLE',
    incidente_asignado_id: null,
    base: { lat: -33.425, lng: -70.615 },
    ubicacion: { lat: -33.425, lng: -70.615 },
  },
  {
    id: 'demo-rec-2',
    tipo: 'Bomberos',
    estado_actual: 'ASIGNADO',
    incidente_asignado_id: 'demo-1',
    base: { lat: -33.436, lng: -70.634 },
    ubicacion: { lat: -33.436, lng: -70.634 },
  },
  {
    id: 'demo-rec-3',
    tipo: 'Ambulancia',
    estado_actual: 'EN_ESCENA',
    incidente_asignado_id: 'demo-1',
    base: { lat: -33.4405, lng: -70.6506 },
    ubicacion: { lat: -33.41, lng: -70.63 },
  },
  {
    id: 'demo-rec-4',
    tipo: 'Policía',
    estado_actual: 'DISPONIBLE',
    incidente_asignado_id: null,
    base: { lat: -33.432, lng: -70.645 },
    ubicacion: { lat: -33.432, lng: -70.645 },
  },
  {
    id: 'demo-rec-5',
    tipo: 'Ambulancia',
    estado_actual: 'INOPERATIVO',
    incidente_asignado_id: null,
    base: { lat: -33.447, lng: -70.601 },
    ubicacion: { lat: -33.447, lng: -70.601 },
  },
];

/** Historia de los recursos que arrancan ocupados, referida a la hora del servicio para que sus SLA tengan sentido. */
function eventosIniciales(ahoraMs: number): readonly EventoRecurso[] {
  const hace = (min: number): string => new Date(ahoraMs - min * 60_000).toISOString();
  const evento = (
    n: number,
    recursoId: string,
    desde: EventoRecurso['desde'],
    hacia: EventoRecurso['hacia'],
    min: number,
  ): EventoRecurso => ({ id: `demo-ev${n}`, recursoId, incidenteId: 'demo-1', desde, hacia, origen: 'MANUAL', creadoEn: hace(min) });
  return [
    evento(1, 'demo-rec-3', 'DISPONIBLE', 'ASIGNADO', 14),
    evento(2, 'demo-rec-3', 'ASIGNADO', 'EN_RUTA', 12),
    evento(3, 'demo-rec-3', 'EN_RUTA', 'EN_ESCENA', 8),
    evento(4, 'demo-rec-2', 'DISPONIBLE', 'ASIGNADO', 1),
  ];
}

const zonasIniciales: readonly ZonaPublica[] = [
  {
    id: 'demo-z1',
    tipo: 'Refugio',
    nombre: 'Coliseo Municipal',
    geometria: { type: 'Point', coordinates: [-70.65, -33.44] },
    capacidad_actual: 45,
    capacidad_maxima: 200,
  },
  {
    id: 'demo-z2',
    tipo: 'Refugio',
    nombre: 'Colegio Central',
    geometria: { type: 'Point', coordinates: [-70.63, -33.41] },
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
  const tIncidentes = crearTabla<Incidente>(incidentes);
  const tLlamadas = crearTabla<Llamada>(llamadasIniciales);
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
