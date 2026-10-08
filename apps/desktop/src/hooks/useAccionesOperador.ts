import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  agregarEvento,
  incidenteDesdeReporte,
  transicionarRecurso,
  zonaDesdeTrazado,
  type EstadoIncidente,
  type EstadoRecurso,
  type Incidente,
  type Recurso,
  type Reporte,
  type ZonaPublica,
} from '@argos/shared';
import type { FiguraTrazada } from '../domain/trazado';
import type { ServicioMesa } from '../services/supabaseClient';

interface Opciones {
  readonly servicio: ServicioMesa;
  readonly incidentes: readonly Incidente[];
  readonly seleccionadoId: string | null;
  readonly alSeleccionar: (id: string) => void;
  readonly alAvisar: (mensaje: string | null) => void;
}

export interface AccionesOperador {
  readonly confirmarReporte: (reporte: Reporte) => void;
  readonly descartarReporte: (reporte: Reporte) => void;
  readonly cambiarEstadoIncidente: (incidente: Incidente, estado: EstadoIncidente) => void;
  /**
   * Un polígono con incidente seleccionado pasa a ser su zona de riesgo; cualquier otra figura
   * (sin incidente, o una línea) se guarda en `zonas_publicas`.
   * Identidad estable: el mapa reinicia el trazado si cambia.
   */
  readonly guardarTrazado: (figura: FiguraTrazada) => void;
  /** `delta` relativo (p. ej. +5 / -5); la base lo aplica de forma atómica. */
  readonly cambiarOcupacion: (zona: ZonaPublica, delta: number) => void;
  /**
   * Al despachar, `incidenteId` fija el incidente destino (el que muestra PanelDetalle); sin él se
   * usa el seleccionado.
   */
  readonly cambiarEstadoRecurso: (recurso: Recurso, estado: EstadoRecurso, incidenteId?: string) => void;
}

const mensajeDe = (err: unknown): string => (err instanceof Error ? err.message : 'Error desconocido');

/** Casos de uso del operador sobre el servicio; los errores se muestran como aviso. */
export function useAccionesOperador({
  servicio,
  incidentes,
  seleccionadoId,
  alSeleccionar,
  alAvisar,
}: Opciones): AccionesOperador {
  const ultimo = useRef({ incidentes, seleccionadoId });
  useEffect(() => {
    ultimo.current = { incidentes, seleccionadoId };
  });

  const ejecutar = useCallback(
    (tarea: () => Promise<unknown>, exito?: string) => {
      alAvisar(null);
      new Promise<unknown>((resolver) => resolver(tarea())).then(
        () => {
          if (exito) alAvisar(exito);
        },
        (err: unknown) => alAvisar(mensajeDe(err)),
      );
    },
    [alAvisar],
  );

  const guardarTrazado = useCallback(
    (figura: FiguraTrazada) => {
      const { incidentes: lista, seleccionadoId: id } = ultimo.current;
      const incidente = lista.find((i) => i.id === id);
      if (figura.type === 'Polygon' && incidente) {
        ejecutar(
          () =>
            servicio.actualizarIncidente(incidente.id, {
              geometria: figura,
              timeline: agregarEvento(incidente.timeline, 'Zona de riesgo trazada por operador'),
            }),
          `Zona de riesgo guardada en "${incidente.titulo}" (${figura.coordinates[0]?.length ?? 0} puntos)`,
        );
        return;
      }
      const zona = zonaDesdeTrazado(figura);
      ejecutar(() => servicio.crearZonaPublica(zona), `"${zona.nombre}" guardado en zonas públicas`);
    },
    [servicio, ejecutar],
  );

  return useMemo<AccionesOperador>(
    () => ({
      guardarTrazado,
      confirmarReporte: (reporte) =>
        ejecutar(async () => {
          const incidente = await servicio.crearIncidente(incidenteDesdeReporte(reporte));
          await servicio.actualizarEstadoReporte(reporte.id, 'Confirmado');
          alSeleccionar(incidente.id);
        }),
      descartarReporte: (reporte) => ejecutar(() => servicio.actualizarEstadoReporte(reporte.id, 'Descartado')),
      cambiarEstadoIncidente: (incidente, estado) =>
        ejecutar(() =>
          servicio.actualizarIncidente(incidente.id, {
            estado,
            timeline: agregarEvento(incidente.timeline, `Estado cambiado a ${estado}`),
          }),
        ),
      cambiarOcupacion: (zona, delta) => ejecutar(() => servicio.ajustarOcupacionZona(zona.id, delta)),
      cambiarEstadoRecurso: (recurso, estado, incidenteId) =>
        ejecutar(() => {
          // Despachar usa el incidente indicado (o el seleccionado); otras transiciones lo conservan o liberan.
          const siguiente = transicionarRecurso(recurso, estado, incidenteId ?? ultimo.current.seleccionadoId ?? undefined);
          return servicio.cambiarEstadoRecurso(recurso.id, estado, siguiente.incidente_asignado_id);
        }),
    }),
    [servicio, ejecutar, alSeleccionar, guardarTrazado],
  );
}
