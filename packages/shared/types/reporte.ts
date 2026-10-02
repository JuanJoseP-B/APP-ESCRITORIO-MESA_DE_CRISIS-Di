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
