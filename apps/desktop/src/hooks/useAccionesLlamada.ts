import { useCallback, useMemo } from 'react';
import type { NuevaLlamada } from '@argos/shared';
import { codigoIncidente } from '../domain/cola';
import { incidenteDesdeLlamada } from '../domain/llamadas';
import type { ServicioMesa } from '../services/supabaseClient';

interface Opciones {
  readonly servicio: ServicioMesa;
  readonly alSeleccionar: (id: string) => void;
  readonly alAvisar: (mensaje: string | null) => void;
  /** Quien opera la consola; queda como autor de la bitácora. */
  readonly operador?: string;
  /** Hora de la consola (ms epoch); por defecto la del equipo. En el demo es la del reloj simulado. */
  readonly ahora?: () => number;
}

export interface AccionesLlamada {
  /**
   * Abre un incidente nuevo con los datos de la llamada. Con `llamadaId` esa llamada entrante queda vinculada
   * al incidente; sin él (llamada manual) se registra ya vinculada. Resuelve `true` si todo se guardó.
   */
  readonly crearIncidente: (datos: NuevaLlamada, llamadaId: string | null) => Promise<boolean>;
}

const mensajeDe = (err: unknown): string => (err instanceof Error ? err.message : 'Error desconocido');

/** Casos de uso del formulario de llamada; los errores se muestran como aviso y nunca rechazan. */
export function useAccionesLlamada({ servicio, alSeleccionar, alAvisar, operador, ahora = Date.now }: Opciones): AccionesLlamada {
  const crearIncidente = useCallback(
    async (datos: NuevaLlamada, llamadaId: string | null): Promise<boolean> => {
      alAvisar(null);
      try {
        const incidente = await servicio.crearIncidente(incidenteDesdeLlamada(datos, new Date(ahora()), operador));
        if (llamadaId) await servicio.vincularLlamada(llamadaId, incidente.id);
        else await servicio.registrarLlamada(datos, incidente.id);
        alSeleccionar(incidente.id);
        alAvisar(`Incidente #${codigoIncidente(incidente.id)} creado desde la llamada`);
        return true;
      } catch (err) {
        alAvisar(mensajeDe(err));
        return false;
      }
    },
    [servicio, alSeleccionar, alAvisar, operador, ahora],
  );

  return useMemo(() => ({ crearIncidente }), [crearIncidente]);
}
