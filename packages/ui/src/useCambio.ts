import { useEffect, useRef, useState } from 'react';
import { duracion, type NombreDuracion } from './movimiento';

/**
 * `true` durante `--dur-<nombre>` después de que `valor` cambie (no al montar): los componentes lo usan para
 * destacar un instante el valor nuevo. Con movimiento reducido el token vale 0 y nunca se activa.
 */
export function useCambio(valor: string, nombre: NombreDuracion = 'base', activo = true): boolean {
  const [cambiando, setCambiando] = useState(false);
  const previo = useRef(valor);

  useEffect(() => {
    if (previo.current === valor) return;
    previo.current = valor;
    const ms = activo ? duracion(nombre) : 0;
    if (ms <= 0) return;
    setCambiando(true);
    const temporizador = setTimeout(() => setCambiando(false), ms);
    return () => clearTimeout(temporizador);
  }, [valor, nombre, activo]);

  return cambiando;
}
