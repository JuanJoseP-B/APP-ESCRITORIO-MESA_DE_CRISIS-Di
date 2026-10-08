/** Parte de `KeyboardEvent` que usa el dominio; permite probarlo sin DOM. */
export interface TeclaPulsada {
  readonly key: string;
  readonly ctrlKey: boolean;
  readonly metaKey: boolean;
  readonly altKey: boolean;
}

/** Nombre canónico → acción. Teclas: "F2", "[", "j", "Escape", "Ctrl+Enter"… (letras en minúscula). */
export type MapaAtajos = Readonly<Record<string, () => void>>;

/** Atajos que siguen activos aunque el foco esté en un campo de texto. */
export const ATAJOS_EN_CAMPOS: readonly string[] = ['Escape', 'Ctrl+Enter'];

/**
 * Nombre canónico de la tecla, o `null` si la combinación no es un atajo de la consola.
 * En teclados con AltGr (español), `[` llega como Ctrl+Alt: esa pareja no cuenta como modificador.
 */
export function nombreDeTecla(e: TeclaPulsada): string | null {
  if (e.key === 'Enter') return (e.ctrlKey || e.metaKey) && !e.altKey ? 'Ctrl+Enter' : null;
  if (e.key === 'Escape' || /^F([1-9]|1[0-2])$/.test(e.key)) return e.key;
  if (e.key.length !== 1) return null;
  const altGr = e.ctrlKey && e.altKey;
  if (!altGr && (e.ctrlKey || e.altKey)) return null;
  return e.metaKey ? null : e.key.toLowerCase();
}

/** `true` si escribir en el elemento no debe disparar atajos (inputs, textarea, select, contenteditable). */
export function esCampoDeEntrada(destino: unknown): boolean {
  if (typeof destino !== 'object' || destino === null) return false;
  const el = destino as { tagName?: unknown; isContentEditable?: unknown };
  if (el.isContentEditable === true) return true;
  return typeof el.tagName === 'string' && ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName.toUpperCase());
}

/** Acción que corresponde a la pulsación, o `null` si no hay atajo o el foco está en un campo. */
export function resolverAtajo(mapa: MapaAtajos, tecla: TeclaPulsada, destino: unknown): (() => void) | null {
  const nombre = nombreDeTecla(tecla);
  if (nombre === null) return null;
  if (esCampoDeEntrada(destino) && !ATAJOS_EN_CAMPOS.includes(nombre)) return null;
  return Object.hasOwn(mapa, nombre) ? (mapa[nombre] ?? null) : null;
}
