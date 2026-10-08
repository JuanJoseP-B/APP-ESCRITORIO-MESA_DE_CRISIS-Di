import { useEffect, useState } from 'react';

/**
 * Hora corregida (ms epoch) que se actualiza cada `intervaloMs`. `desfaseMs` es la diferencia
 * servidor − local (ver `calcularDesfaseMs`); `ahora` se inyecta en las pruebas.
 */
export function useReloj(desfaseMs = 0, intervaloMs = 1000, ahora: () => number = Date.now): number {
  const [hora, setHora] = useState(() => ahora() + desfaseMs);

  useEffect(() => {
    const actualizar = () => setHora(ahora() + desfaseMs);
    actualizar();
    const id = setInterval(actualizar, intervaloMs);
    return () => clearInterval(id);
  }, [desfaseMs, intervaloMs, ahora]);

  return hora;
}
