import { ajustarOcupacion, type Incidente, type Recurso, type Reporte, type ZonaPublica } from '@argos/shared';
import type { CambioRealtime } from '../domain/realtime';
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

const reportes: readonly Reporte[] = [
  {
    id: 'demo-r1',
    tipo: 'INCENDIO',
    lat: -33.45,
    lng: -70.66,
    imagen_url: null,
    estado_validacion: 'No confirmado',
    creado_en: '2026-10-02T08:20:00Z',
  },
];

const recursosIniciales: readonly Recurso[] = [
  { id: 'demo-rec-1', tipo: 'Bomberos', estado_actual: 'Disponible', incidente_asignado_id: null },
  { id: 'demo-rec-2', tipo: 'Bomberos', estado_actual: 'Despachado', incidente_asignado_id: 'demo-1' },
  { id: 'demo-rec-3', tipo: 'Ambulancia', estado_actual: 'En Escena', incidente_asignado_id: 'demo-1' },
  { id: 'demo-rec-4', tipo: 'Policía', estado_actual: 'Disponible', incidente_asignado_id: null },
  { id: 'demo-rec-5', tipo: 'Ambulancia', estado_actual: 'Inoperativo', incidente_asignado_id: null },
];

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

/** Datos locales de ejemplo para desarrollar la UI sin backend; no hace consultas de red. */
export function crearServicioDemo(): ServicioMesa {
  const tIncidentes = crearTabla<Incidente>(incidentes);
  const tReportes = crearTabla<Reporte>(reportes);
  const tRecursos = crearTabla<Recurso>(recursosIniciales);
  const tZonas = crearTabla<ZonaPublica>(zonasIniciales);
  let contador = 0;
  const sesion = { email: 'demo@local', esOperador: true };
  const envolver = <R>(f: () => R): Promise<R> => {
    try {
      return Promise.resolve(f());
    } catch (err) {
      return Promise.reject(err instanceof Error ? err : new Error('Error desconocido'));
    }
  };

  return {
    listarIncidentes: tIncidentes.listar,
    listarReportes: tReportes.listar,
    suscribirIncidentes: tIncidentes.suscribir,
    suscribirReportes: tReportes.suscribir,
    listarRecursos: tRecursos.listar,
    suscribirRecursos: tRecursos.suscribir,
    cambiarEstadoRecurso: (id, estado, incidenteId) =>
      envolver(() => tRecursos.actualizar(id, { estado_actual: estado, incidente_asignado_id: incidenteId })),
    crearIncidente: (nuevo) => {
      const incidente: Incidente = { ...nuevo, id: `demo-i${++contador}` };
      tIncidentes.insertar(incidente);
      return Promise.resolve(incidente);
    },
    actualizarIncidente: (id, cambios) => envolver(() => void tIncidentes.actualizar(id, cambios)),
    actualizarEstadoReporte: (id, estado) =>
      envolver(() => void tReportes.actualizar(id, { estado_validacion: estado })),
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
