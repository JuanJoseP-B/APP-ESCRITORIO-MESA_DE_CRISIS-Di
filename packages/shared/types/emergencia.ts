/** Catálogo completo de tipos de emergencia; es el valor que se persiste en `reportes_ciudadanos.tipo`. */
export const TIPOS_EMERGENCIA = [
  'INCENDIO',
  'CRECIENTE_SUBITA',
  'DESLIZAMIENTO',
  'VIA_BLOQUEADA',
  'FUGA_GAS',
  'INUNDACION',
] as const;
export type TipoEmergencia = (typeof TIPOS_EMERGENCIA)[number];

export const ETIQUETAS_TIPO_EMERGENCIA: Readonly<Record<TipoEmergencia, string>> = {
  INCENDIO: 'Incendio',
  CRECIENTE_SUBITA: 'Creciente súbita',
  DESLIZAMIENTO: 'Deslizamiento',
  VIA_BLOQUEADA: 'Vía bloqueada',
  FUGA_GAS: 'Fuga de gas',
  INUNDACION: 'Inundación',
};

export const esTipoEmergencia = (valor: unknown): valor is TipoEmergencia =>
  (TIPOS_EMERGENCIA as readonly unknown[]).includes(valor);

/** Texto legible del tipo; un valor fuera del catálogo (fila antigua) se muestra tal cual. */
export const etiquetaTipoEmergencia = (tipo: string): string =>
  esTipoEmergencia(tipo) ? ETIQUETAS_TIPO_EMERGENCIA[tipo] : tipo;
