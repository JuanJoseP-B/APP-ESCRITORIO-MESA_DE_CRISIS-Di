export const TIPOS_ZONA_PUBLICA = ['Refugio', 'Bloqueo de Vía'] as const;
export type TipoZonaPublica = (typeof TIPOS_ZONA_PUBLICA)[number];

export interface ZonaPublica {
  readonly id: string;
  readonly tipo: TipoZonaPublica;
  readonly capacidad_actual: number;
  readonly capacidad_maxima: number;
}
