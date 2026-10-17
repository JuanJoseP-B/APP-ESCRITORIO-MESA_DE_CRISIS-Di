export const TEMAS = ['crema', 'carbon'] as const;
/** Tema que se pinta en pantalla. */
export type Tema = (typeof TEMAS)[number];

/** Lo que elige el operador: un tema fijo o seguir al sistema (`prefers-color-scheme`). */
export const TEMAS_PREFERIDOS = ['crema', 'carbon', 'sistema'] as const;
export type TemaPreferido = (typeof TEMAS_PREFERIDOS)[number];

export const CLAVE_TEMA = 'argos.tema';
const CONSULTA_OSCURO = '(prefers-color-scheme: dark)';

export function esTemaPreferido(v: string | null): v is TemaPreferido {
  return v === 'crema' || v === 'carbon' || v === 'sistema';
}

/** Lee la preferencia guardada (crema por defecto); el almacenamiento puede no estar disponible. */
export function temaPreferidoGuardado(): TemaPreferido {
  try {
    const v = localStorage.getItem(CLAVE_TEMA);
    return esTemaPreferido(v) ? v : 'crema';
  } catch {
    return 'crema';
  }
}

export function guardarTemaPreferido(tema: TemaPreferido): void {
  try {
    localStorage.setItem(CLAVE_TEMA, tema);
  } catch {
    /* sin persistencia: el tema sigue aplicado en esta sesión */
  }
}

/** Tema a pintar: el elegido o, con «sistema», el que pide el sistema operativo. */
export function resolverTema(preferido: TemaPreferido, sistemaOscuro: boolean): Tema {
  if (preferido === 'sistema') return sistemaOscuro ? 'carbon' : 'crema';
  return preferido;
}

/** Consulta de `prefers-color-scheme: dark`; `null` donde `matchMedia` no existe. */
export function consultaSistemaOscuro(): MediaQueryList | null {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(CONSULTA_OSCURO) : null;
}

export function sistemaPrefiereOscuro(): boolean {
  return consultaSistemaOscuro()?.matches ?? false;
}

/** Pinta el tema en `<html>`; el mapa lo observa para repintarse. */
export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.theme = tema;
}
