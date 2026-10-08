export type EstadoEnlace = 'EN_VIVO' | 'CONECTANDO' | 'SIN_ENLACE';

export interface CargaLista {
  readonly cargando: boolean;
  readonly error: string | null;
}

/**
 * Resume el enlace con Supabase a partir de las listas en tiempo real: cualquier error es "sin
 * enlace" (prevalece), si no hay error pero alguna sigue cargando es "conectando".
 */
export function estadoEnlace(listas: readonly CargaLista[]): EstadoEnlace {
  if (listas.some((l) => l.error !== null)) return 'SIN_ENLACE';
  return listas.some((l) => l.cargando) ? 'CONECTANDO' : 'EN_VIVO';
}
