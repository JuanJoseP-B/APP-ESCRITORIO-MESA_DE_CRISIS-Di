/**
 * Fuente de claves de los textos de la consola. `en.ts` se tipa contra este objeto, así que una
 * clave que falte (o sobre) allí rompe el typecheck. Los parámetros se escriben como `{nombre}`.
 */
export const es = {
  'idioma.es': 'Español',
  'idioma.en': 'English',
} as const;

export type ClaveTexto = keyof typeof es;

/** Forma que debe cumplir cada idioma: exactamente las claves de `es`. */
export type Diccionario = Record<ClaveTexto, string>;
