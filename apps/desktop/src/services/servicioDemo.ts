import type { Incidente, Recurso, Reporte } from '@argos/shared';
import type { CambioRealtime } from '../domain/realtime';
import type { ServicioMesa } from './supabaseClient';

const incidentes: readonly Incidente[] = [
  {
    id: 'demo-1',
    titulo: 'Incendio forestal cerro San Cristóbal',
    nivel_criticidad: 'Crítico',
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
    estado: 'Contenido',
    geometria: { type: 'Point', coordinates: [-70.61, -33.43] },
    timeline: [{ timestamp: '2026-10-02T07:40:00Z', descripcion: 'Corte de tránsito' }],
  },
];

const reportes: readonly Reporte[] = [
  {
    id: 'demo-r1',
    tipo: 'Incendio',
    lat: -33.45,
    lng: -70.66,
    imagen_url: null,
    estado_validacion: 'No confirmado',
  },
];

const recursosIniciales: readonly Recurso[] = [
  { id: 'demo-rec-1', tipo: 'Bomberos', estado_actual: 'Disponible', incidente_asignado_id: null },
  { id: 'demo-rec-2', tipo: 'Bomberos', estado_actual: 'Despachado', incidente_asignado_id: 'demo-1' },
  { id: 'demo-rec-3', tipo: 'Ambulancia', estado_actual: 'En Escena', incidente_asignado_id: 'demo-1' },
  { id: 'demo-rec-4', tipo: 'Policía', estado_actual: 'Disponible', incidente_asignado_id: null },
  { id: 'demo-rec-5', tipo: 'Ambulancia', estado_actual: 'Inoperativo', incidente_asignado_id: null },
];

/** Datos locales de ejemplo para desarrollar la UI sin backend; no hace consultas de red. */
export function crearServicioDemo(): ServicioMesa {
  let recursos = recursosIniciales;
  const oyentes = new Set<(cambio: CambioRealtime<Recurso>) => void>();

  return {
    listarIncidentes: () => Promise.resolve(incidentes),
    listarReportes: () => Promise.resolve(reportes),
    suscribirIncidentes: () => () => undefined,
    suscribirReportes: () => () => undefined,
    listarRecursos: () => Promise.resolve(recursos),
    suscribirRecursos: (cb) => {
      oyentes.add(cb);
      return () => void oyentes.delete(cb);
    },
    cambiarEstadoRecurso: (id, estado, incidenteId) => {
      const actual = recursos.find((r) => r.id === id);
      if (!actual) return Promise.reject(new Error(`Recurso ${id} no existe`));
      const nuevo: Recurso = { ...actual, estado_actual: estado, incidente_asignado_id: incidenteId };
      recursos = recursos.map((r) => (r.id === id ? nuevo : r));
      oyentes.forEach((cb) => cb({ tipo: 'UPDATE', nuevo, idEliminado: null }));
      return Promise.resolve();
    },
  };
}

export const servicioDemo: ServicioMesa = crearServicioDemo();
