import type { ZonaPublica, ZonaRiesgo } from '@argos/shared';
import type { ServicioPortal } from './supabaseClient';

const zonasRiesgo: readonly ZonaRiesgo[] = [
  {
    id: 'demo-riesgo-1',
    titulo: 'Incendio estructural — Barrio Brasil',
    nivel_criticidad: 'Crítico',
    estado: 'Abierto',
    geometria: {
      type: 'Polygon',
      coordinates: [
        [
          [-70.682, -33.44],
          [-70.672, -33.44],
          [-70.672, -33.448],
          [-70.682, -33.448],
          [-70.682, -33.44],
        ],
      ],
    },
  },
  {
    id: 'demo-riesgo-2',
    titulo: 'Anegamiento — Ribera del Mapocho',
    nivel_criticidad: 'Medio',
    estado: 'Contenido',
    geometria: {
      type: 'Polygon',
      coordinates: [
        [
          [-70.64, -33.425],
          [-70.625, -33.425],
          [-70.625, -33.432],
          [-70.64, -33.432],
          [-70.64, -33.425],
        ],
      ],
    },
  },
];

const zonasPublicas: readonly ZonaPublica[] = [
  {
    id: 'demo-refugio-1',
    tipo: 'Refugio',
    nombre: 'Gimnasio Municipal Santiago Centro',
    geometria: { type: 'Point', coordinates: [-70.655, -33.455] },
    capacidad_actual: 48,
    capacidad_maxima: 150,
  },
  {
    id: 'demo-refugio-2',
    tipo: 'Refugio',
    nombre: 'Liceo Experimental',
    geometria: { type: 'Point', coordinates: [-70.69, -33.43] },
    capacidad_actual: 112,
    capacidad_maxima: 120,
  },
  {
    id: 'demo-bloqueo-1',
    tipo: 'Bloqueo de Vía',
    nombre: "Av. Libertador B. O'Higgins cortada",
    geometria: { type: 'Point', coordinates: [-70.675, -33.4455] },
    capacidad_actual: 0,
    capacidad_maxima: 0,
  },
];

/** Servicio local sin backend: datos de ejemplo; los reportes se descartan. */
export const servicioDemo: ServicioPortal = {
  listarZonasPublicas: () => Promise.resolve(zonasPublicas),
  listarZonasRiesgo: () => Promise.resolve(zonasRiesgo),
  suscribirZonasPublicas: () => () => undefined,
  suscribirZonasRiesgo: () => () => undefined,
  enviarReporte: () => Promise.resolve(crypto.randomUUID()),
};
