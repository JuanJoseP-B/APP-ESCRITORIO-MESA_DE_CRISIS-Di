import { en } from './en';
import { es, type ClaveTexto, type Diccionario } from './es';

export const IDIOMAS = ['es', 'en'] as const;
export type Idioma = (typeof IDIOMAS)[number];

export const IDIOMA_POR_DEFECTO: Idioma = 'es';

export const CLAVE_IDIOMA = 'argos.idioma';

export type ParamsTexto = Readonly<Record<string, string | number>>;

export const DICCIONARIOS: Readonly<Record<Idioma, Diccionario>> = { es, en };

export function esIdioma(v: string | null): v is Idioma {
  return v === 'es' || v === 'en';
}

/** Lee el idioma guardado (español por defecto); el almacenamiento puede no estar disponible. */
export function idiomaGuardado(): Idioma {
  try {
    const v = localStorage.getItem(CLAVE_IDIOMA);
    return esIdioma(v) ? v : IDIOMA_POR_DEFECTO;
  } catch {
    return IDIOMA_POR_DEFECTO;
  }
}

export function guardarIdioma(idioma: Idioma): void {
  try {
    localStorage.setItem(CLAVE_IDIOMA, idioma);
  } catch {
    /* sin persistencia: el idioma sigue aplicado en esta sesión */
  }
}

/** Sustituye `{nombre}` por su valor; un parámetro ausente deja el marcador a la vista. */
export function traducir(diccionario: Diccionario, clave: ClaveTexto, params?: ParamsTexto): string {
  const texto = diccionario[clave];
  if (!params) return texto;
  return texto.replace(/\{(\w+)\}/g, (marcador, nombre: string) => {
    const valor = params[nombre];
    return valor === undefined ? marcador : String(valor);
  });
}
