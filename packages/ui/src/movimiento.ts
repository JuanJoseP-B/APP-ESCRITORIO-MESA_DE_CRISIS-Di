/**
 * Puente tokens de movimiento → JS y mapa. MapLibre y Motion necesitan números, no `var(--x)`:
 * se leen del tema activo. Con movimiento reducido los tokens valen 0ms y `duracion()` devuelve 0.
 */

export const NOMBRES_DURACION = ['instant', 'fast', 'base', 'slow'] as const;
export type NombreDuracion = (typeof NOMBRES_DURACION)[number];

/** Respaldo si el token no existe (pruebas de un componente suelto): los mismos valores de `tokens.css`. */
const RESPALDO_MS: Readonly<Record<NombreDuracion, number>> = { instant: 80, fast: 150, base: 240, slow: 400 };

/** Convierte `240ms`, `0.24s` o `0` en milisegundos; `null` si no es una duración. */
export function milisegundos(valor: string): number | null {
  const m = /^(-?\d*\.?\d+)(ms|s)?$/.exec(valor.trim());
  if (!m || m[1] === undefined) return null;
  const n = Number(m[1]);
  return m[2] === 's' ? n * 1000 : n;
}

/** Duración del token `--dur-<nombre>` en milisegundos (0 con movimiento reducido). */
export function duracion(nombre: NombreDuracion, raiz: Element = document.documentElement): number {
  const crudo = getComputedStyle(raiz).getPropertyValue(`--dur-${nombre}`);
  return milisegundos(crudo) ?? RESPALDO_MS[nombre];
}

/** Lo mismo en segundos, que es lo que pide Motion (`transition.duration`). */
export const duracionSegundos = (nombre: NombreDuracion, raiz?: Element): number => duracion(nombre, raiz) / 1000;

/** `true` si el operador pidió reducir el movimiento (ajuste o preferencia del sistema). */
export function movimientoReducido(raiz: HTMLElement = document.documentElement): boolean {
  if (raiz.dataset['reducedMotion'] === 'true') return true;
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export const NOMBRES_CURVA = ['mecanico', 'salida'] as const;
export type NombreCurva = (typeof NOMBRES_CURVA)[number];
export type CurvaBezier = [number, number, number, number];

/** Respaldo si el token no existe: las mismas curvas de `tokens.css`. */
const RESPALDO_CURVA: Readonly<Record<NombreCurva, CurvaBezier>> = { mecanico: [0.2, 0, 0, 1], salida: [0, 0, 0.2, 1] };

/** Curva del token `--ease-<nombre>` como los cuatro puntos que pide Motion (`transition.ease`). */
export function curva(nombre: NombreCurva, raiz: Element = document.documentElement): CurvaBezier {
  const m = /^cubic-bezier\(([^)]+)\)$/.exec(getComputedStyle(raiz).getPropertyValue(`--ease-${nombre}`).trim());
  const puntos = m?.[1]?.split(',').map((p) => Number(p.trim())) ?? [];
  const [a, b, c, d] = puntos;
  if (puntos.length !== 4 || a === undefined || b === undefined || c === undefined || d === undefined || puntos.some(Number.isNaN)) return [...RESPALDO_CURVA[nombre]];
  return [a, b, c, d];
}
