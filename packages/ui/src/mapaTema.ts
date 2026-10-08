/**
 * Puente tokens → mapa. MapLibre pinta con valores concretos (no entiende `var(--x)`),
 * así que se leen del tema activo y se vuelven a aplicar cuando cambia `data-theme`.
 */

/** Valor resuelto de un token CSS (p. ej. `status-critical`) en el tema actual; '' si no existe. */
export function leerToken(nombre: string, raiz: Element = document.documentElement): string {
  return getComputedStyle(raiz).getPropertyValue(`--${nombre}`).trim();
}

/** Avisa cada vez que cambia el turno visual (`data-theme`). Devuelve la función para dejar de observar. */
export function observarTema(alCambiar: () => void, raiz: HTMLElement = document.documentElement): () => void {
  const observador = new MutationObserver(alCambiar);
  observador.observe(raiz, { attributes: true, attributeFilter: ['data-theme'] });
  return () => observador.disconnect();
}

/** Opacidad de relleno de zona (token `opacity-zone-fill`), con respaldo si falta. */
export function opacidadZona(): number {
  const valor = Number(leerToken('opacity-zone-fill'));
  return Number.isFinite(valor) && valor > 0 ? valor : 0.2;
}
