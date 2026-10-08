import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ClaveTexto } from './es';
import {
  DICCIONARIOS,
  IDIOMA_POR_DEFECTO,
  guardarIdioma,
  idiomaGuardado,
  traducir,
  type Idioma,
  type ParamsTexto,
} from './idioma';

export type Traductor = (clave: ClaveTexto, params?: ParamsTexto) => string;

interface ValorIdioma {
  readonly idioma: Idioma;
  readonly fijarIdioma: (idioma: Idioma) => void;
  readonly t: Traductor;
}

function crearValor(idioma: Idioma, fijarIdioma: (idioma: Idioma) => void): ValorIdioma {
  const diccionario = DICCIONARIOS[idioma];
  return { idioma, fijarIdioma, t: (clave, params) => traducir(diccionario, clave, params) };
}

/** Sin proveedor (p. ej. en pruebas de un componente suelto) todo se muestra en español. */
const ContextoIdioma = createContext<ValorIdioma>(crearValor(IDIOMA_POR_DEFECTO, () => undefined));

/** Idioma de la consola: lo recuerda en localStorage y lo publica en `<html lang>`. */
export function IdiomaProvider({ inicial, children }: { readonly inicial?: Idioma; readonly children: ReactNode }) {
  const [idioma, setIdioma] = useState<Idioma>(() => inicial ?? idiomaGuardado());
  useEffect(() => {
    document.documentElement.lang = idioma;
    guardarIdioma(idioma);
  }, [idioma]);
  const fijarIdioma = useCallback((nuevo: Idioma) => setIdioma(nuevo), []);
  const valor = useMemo(() => crearValor(idioma, fijarIdioma), [idioma, fijarIdioma]);
  return <ContextoIdioma.Provider value={valor}>{children}</ContextoIdioma.Provider>;
}

/** `t('clave', { param })` en el idioma activo, más el idioma y su selector. */
export function useTexto(): ValorIdioma {
  return useContext(ContextoIdioma);
}
