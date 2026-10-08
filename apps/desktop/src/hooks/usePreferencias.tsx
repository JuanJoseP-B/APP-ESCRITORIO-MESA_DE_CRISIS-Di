import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  PREFERENCIAS_POR_DEFECTO,
  aplicarPreferencias,
  guardarPreferencias,
  leerPreferencias,
  type Preferencias,
} from '../domain/preferencias';
import { useTexto } from '../i18n/IdiomaProvider';
import { consultaSistemaOscuro, resolverTema, sistemaPrefiereOscuro, type Tema } from '../tema';

interface ValorPreferencias {
  readonly preferencias: Preferencias;
  /** Tema que se pinta: con «sistema» sigue al sistema operativo. */
  readonly temaEfectivo: Tema;
  readonly fijar: (cambios: Partial<Preferencias>) => void;
}

type PreferenciasSinIdioma = Omit<Preferencias, 'idioma'>;

function sinIdioma(p: Preferencias): PreferenciasSinIdioma {
  return { tema: p.tema, reducirMovimiento: p.reducirMovimiento, textoGrande: p.textoGrande };
}

/** Sin proveedor (pruebas de un componente suelto) rigen los valores por defecto. */
const ContextoPreferencias = createContext<ValorPreferencias>({
  preferencias: PREFERENCIAS_POR_DEFECTO,
  temaEfectivo: 'crema',
  fijar: () => undefined,
});

/**
 * Tema, movimiento y tamaño de texto: los aplica a `<html>`, los recuerda y, con tema «sistema»,
 * reacciona a los cambios de `prefers-color-scheme`. El idioma lo gobierna `IdiomaProvider`.
 */
export function PreferenciasProvider({ children }: { readonly children: ReactNode }) {
  const { idioma, fijarIdioma } = useTexto();
  const [guardadas, setGuardadas] = useState<PreferenciasSinIdioma>(() => sinIdioma(leerPreferencias()));
  const [sistemaOscuro, setSistemaOscuro] = useState(sistemaPrefiereOscuro);

  useEffect(() => {
    const consulta = consultaSistemaOscuro();
    if (!consulta) return;
    const alCambiar = (e: MediaQueryListEvent) => setSistemaOscuro(e.matches);
    consulta.addEventListener('change', alCambiar);
    return () => consulta.removeEventListener('change', alCambiar);
  }, []);

  const preferencias = useMemo<Preferencias>(() => ({ ...guardadas, idioma }), [guardadas, idioma]);
  useEffect(() => {
    aplicarPreferencias(preferencias, sistemaOscuro);
    guardarPreferencias(preferencias);
  }, [preferencias, sistemaOscuro]);

  const fijar = useCallback(
    (cambios: Partial<Preferencias>) => {
      const { idioma: nuevoIdioma, ...resto } = cambios;
      if (nuevoIdioma) fijarIdioma(nuevoIdioma);
      setGuardadas((actuales) => ({ ...actuales, ...resto }));
    },
    [fijarIdioma],
  );

  const valor = useMemo<ValorPreferencias>(
    () => ({ preferencias, temaEfectivo: resolverTema(preferencias.tema, sistemaOscuro), fijar }),
    [preferencias, sistemaOscuro, fijar],
  );
  return <ContextoPreferencias.Provider value={valor}>{children}</ContextoPreferencias.Provider>;
}

export function usePreferencias(): ValorPreferencias {
  return useContext(ContextoPreferencias);
}
