import { useCallback, useEffect, useMemo, useRef } from 'react';
import { agregarEvento, type CandidatoDuplicado, type EventoTimeline, type Incidente, type NuevaLlamada } from '@argos/shared';
import { codigoIncidente } from '../domain/cola';
import { describirCandidato } from '../domain/duplicados';
import { incidenteDesdeLlamada } from '../domain/llamadas';
import { useTexto } from '../i18n/IdiomaProvider';
import type { ServicioMesa } from '../services/supabaseClient';

interface Opciones {
  readonly servicio: ServicioMesa;
  /** Para leer la bitácora vigente del incidente al que se vincula una llamada. */
  readonly incidentes: readonly Incidente[];
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
   * al incidente; sin él (llamada manual) se registra ya vinculada. `descartados` son los posibles duplicados
   * que el operador rechazó: quedan anotados en la bitácora del incidente nuevo. Resuelve `true` si todo se guardó.
   */
  readonly crearIncidente: (
    datos: NuevaLlamada,
    llamadaId: string | null,
    descartados?: readonly CandidatoDuplicado[],
  ) => Promise<boolean>;
  /** Asocia la llamada (entrante o manual) a un incidente abierto y lo anota en su bitácora. Resuelve `true` si se guardó. */
  readonly vincular: (datos: NuevaLlamada, llamadaId: string | null, incidenteId: string) => Promise<boolean>;
}

/** Casos de uso del formulario de llamada; los errores se muestran como aviso y nunca rechazan. */
export function useAccionesLlamada({ servicio, incidentes, alSeleccionar, alAvisar, operador, ahora = Date.now }: Opciones): AccionesLlamada {
  const { t } = useTexto();
  const mensajeDe = useCallback((err: unknown): string => (err instanceof Error ? err.message : t('aviso.errorDesconocido')), [t]);
  const vigentes = useRef(incidentes);
  useEffect(() => {
    vigentes.current = incidentes;
  });

  const crearIncidente = useCallback<AccionesLlamada['crearIncidente']>(
    async (datos, llamadaId, descartados = []) => {
      alAvisar(null);
      try {
        const fecha = new Date(ahora());
        const nuevo = incidenteDesdeLlamada(datos, fecha, operador);
        const timeline = descartados.reduce<readonly EventoTimeline[]>(
          (t, c) => agregarEvento(t, `Posible duplicado de #${c.codigo} (${describirCandidato(c)}) descartado: incidente nuevo`, fecha, operador),
          nuevo.timeline,
        );
        const incidente = await servicio.crearIncidente({ ...nuevo, timeline });
        if (llamadaId) await servicio.vincularLlamada(llamadaId, incidente.id);
        else await servicio.registrarLlamada(datos, incidente.id);
        alSeleccionar(incidente.id);
        alAvisar(t('aviso.incidente.creado', { codigo: codigoIncidente(incidente.id) }));
        return true;
      } catch (err) {
        alAvisar(mensajeDe(err));
        return false;
      }
    },
    [servicio, alSeleccionar, alAvisar, operador, ahora, t, mensajeDe],
  );

  const vincular = useCallback<AccionesLlamada['vincular']>(
    async (datos, llamadaId, incidenteId) => {
      alAvisar(null);
      try {
        const incidente = vigentes.current.find((i) => i.id === incidenteId);
        if (!incidente) throw new Error(t('aviso.incidente.noDisponible'));
        if (llamadaId) await servicio.vincularLlamada(llamadaId, incidenteId);
        else await servicio.registrarLlamada(datos, incidenteId);
        const quien = datos.reportante ? ` de ${datos.reportante}` : '';
        await servicio.actualizarIncidente(incidenteId, {
          timeline: agregarEvento(incidente.timeline, `Llamada ${datos.canal}${quien} vinculada al incidente (${datos.prioridad})`, new Date(ahora()), operador),
        });
        alSeleccionar(incidenteId);
        alAvisar(t('aviso.llamada.vinculada', { codigo: codigoIncidente(incidenteId) }));
        return true;
      } catch (err) {
        alAvisar(mensajeDe(err));
        return false;
      }
    },
    [servicio, alSeleccionar, alAvisar, operador, ahora, t, mensajeDe],
  );

  return useMemo(() => ({ crearIncidente, vincular }), [crearIncidente, vincular]);
}
