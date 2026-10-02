import type { Incidente, Reporte } from '@argos/shared';
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

/** Datos locales de ejemplo para desarrollar la UI sin backend; no hace consultas de red. */
export const servicioDemo: ServicioMesa = {
  listarIncidentes: () => Promise.resolve(incidentes),
  listarReportes: () => Promise.resolve(reportes),
  suscribirIncidentes: () => () => undefined,
  suscribirReportes: () => () => undefined,
};
