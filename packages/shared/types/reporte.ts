import { TIPOS_EMERGENCIA, etiquetaTipoEmergencia, type TipoEmergencia } from './emergencia';
import { agregarEvento, type NuevoIncidente } from './incidente';
import { PRIORIDAD_POR_CRITICIDAD } from './llamada';

export const TIPOS_REPORTE = TIPOS_EMERGENCIA;
export type TipoReporte = TipoEmergencia;

export const ESTADOS_VALIDACION = ['No confirmado', 'Confirmado', 'Descartado'] as const;
export type EstadoValidacion = (typeof ESTADOS_VALIDACION)[number];

export interface Reporte {
  readonly id: string;
  readonly tipo: TipoReporte;
  readonly lat: number;
  readonly lng: number;
  readonly imagen_url: string | null;
  readonly estado_validacion: EstadoValidacion;
  /** Fecha y hora ISO 8601 de recepción; la fija la base de datos. */
  readonly creado_en?: string;
}

/** Datos que envía el ciudadano; el servicio fija `estado_validacion` en "No confirmado". */
export interface NuevoReporte {
  readonly tipo: TipoReporte;
  readonly lat: number;
  readonly lng: number;
  readonly imagen_url?: string | null;
}

/** Código corto (8 caracteres) con que el ciudadano y el operador identifican un reporte. */
export const codigoReporte = (id: string): string => id.slice(0, 8).toUpperCase();

/** Solo un reporte "No confirmado" puede validarse o descartarse. */
export const puedeValidarReporte = (r: Pick<Reporte, 'estado_validacion'>): boolean =>
  r.estado_validacion === 'No confirmado';

/** Incidente inicial (punto en la ubicación del reporte) al confirmar un reporte ciudadano. */
export function incidenteDesdeReporte(reporte: Reporte, ahora: Date = new Date()): NuevoIncidente {
  return {
    titulo: `${etiquetaTipoEmergencia(reporte.tipo)} reportado por ciudadano`,
    nivel_criticidad: 'Medio',
    prioridad: PRIORIDAD_POR_CRITICIDAD.Medio,
    tipo: reporte.tipo,
    estado: 'Abierto',
    geometria: { type: 'Point', coordinates: [reporte.lng, reporte.lat] },
    timeline: agregarEvento([], 'Reporte ciudadano confirmado por operador', ahora),
  };
}
