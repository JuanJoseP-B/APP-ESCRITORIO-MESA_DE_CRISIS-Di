import { useCallback, useState } from 'react';

const PREFIJO = 'argos.panel.';

function leer(clave: string, porDefecto: boolean): boolean {
  try {
    const v = localStorage.getItem(PREFIJO + clave);
    return v === 'colapsado' ? true : v === 'expandido' ? false : porDefecto;
  } catch {
    return porDefecto;
  }
}

function guardar(clave: string, colapsado: boolean): void {
  try {
    localStorage.setItem(PREFIJO + clave, colapsado ? 'colapsado' : 'expandido');
  } catch {
    /* sin persistencia: el panel sigue en su estado durante esta sesión */
  }
}

export interface PanelColapsable {
  readonly colapsado: boolean;
  readonly alternar: () => void;
  readonly colapsar: () => void;
  readonly expandir: () => void;
}

/**
 * Estado plegado/expandido de un panel de la grilla. Se recuerda entre sesiones bajo `clave`
 * (`argos.panel.<clave>`); el almacenamiento puede no estar disponible.
 */
export function usePanelColapsable(clave: string, colapsadoInicial = false): PanelColapsable {
  const [colapsado, setColapsado] = useState(() => leer(clave, colapsadoInicial));

  const fijar = useCallback(
    (valor: boolean | ((anterior: boolean) => boolean)) => {
      setColapsado((anterior) => {
        const siguiente = typeof valor === 'function' ? valor(anterior) : valor;
        guardar(clave, siguiente);
        return siguiente;
      });
    },
    [clave],
  );

  return {
    colapsado,
    alternar: useCallback(() => fijar((c) => !c), [fijar]),
    colapsar: useCallback(() => fijar(true), [fijar]),
    expandir: useCallback(() => fijar(false), [fijar]),
  };
}
