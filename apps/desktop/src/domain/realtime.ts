export type TipoCambio = 'INSERT' | 'UPDATE' | 'DELETE';

export interface CambioRealtime<T extends { readonly id: string }> {
  readonly tipo: TipoCambio;
  /** Fila nueva (INSERT/UPDATE). */
  readonly nuevo: T | null;
  /** Id de la fila eliminada (DELETE). */
  readonly idEliminado: string | null;
}

/** Reductor puro: aplica un cambio de Realtime a una lista por `id`. */
export function aplicarCambio<T extends { readonly id: string }>(
  lista: readonly T[],
  cambio: CambioRealtime<T>,
): readonly T[] {
  switch (cambio.tipo) {
    case 'INSERT': {
      const fila = cambio.nuevo;
      if (!fila) return lista;
      return lista.some((x) => x.id === fila.id)
        ? lista.map((x) => (x.id === fila.id ? fila : x))
        : [...lista, fila];
    }
    case 'UPDATE': {
      const fila = cambio.nuevo;
      if (!fila) return lista;
      return lista.map((x) => (x.id === fila.id ? fila : x));
    }
    case 'DELETE':
      return cambio.idEliminado ? lista.filter((x) => x.id !== cambio.idEliminado) : lista;
  }
}
