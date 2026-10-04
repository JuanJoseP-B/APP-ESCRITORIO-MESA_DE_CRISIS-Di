import { agregarEvento, type NuevoIncidente } from './incidente';

export const TIPOS_REPORTE = ['Incendio', 'Bloqueo', 'Otro'] as const;
export type TipoReporte = (typeof TIPOS_REPORTE)[number];

export const ESTADOS_VALIDACION = ['No confirmado', 'Confirmado', 'Descartado'] as const;
export type EstadoValidacion = (typeof ESTADOS_VALIDACION)[number];

export interface Reporte {
  readonly id: string;
  readonly tipo: TipoReporte;
  readonly lat: number;
  readonly lng: number;
  readonly imagen_url: string | null;
  readonly estado_validacion: EstadoValidacion;
}

/** Datos que envía el ciudadano; el servicio fija `estado_validacion` en "No confirmado". */
export interface NuevoReporte {
  readonly tipo: TipoReporte;
  readonly lat: number;
  readonly lng: number;
  readonly imagen_url?: string | null;
}

/** Solo un reporte "No confirmado" puede validarse o descartarse. */
export const puedeValidarReporte = (r: Pick<Reporte, 'estado_validacion'>): boolean =>
  r.estado_validacion === 'No confirmado';

/** Incidente inicial (punto en la ubicación del reporte) al confirmar un reporte ciudadano. */
export function incidenteDesdeReporte(reporte: Reporte, ahora: Date = new Date()): NuevoIncidente {
  return {
    titulo: `${reporte.tipo} reportado por ciudadano`,
    nivel_criticidad: 'Medio',
    estado: 'Abierto',
    geometria: { type: 'Point', coordinates: [reporte.lng, reporte.lat] },
    timeline: agregarEvento([], 'Reporte ciudadano confirmado por operador', ahora),
  };
}
