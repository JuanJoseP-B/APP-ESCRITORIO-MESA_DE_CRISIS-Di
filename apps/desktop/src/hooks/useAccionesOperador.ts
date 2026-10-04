import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  agregarEvento,
  incidenteDesdeReporte,
  transicionarRecurso,
  type EstadoIncidente,
  type EstadoRecurso,
  type GeoJsonPolygon,
  type Incidente,
  type Recurso,
  type Reporte,
  type ZonaPublica,
} from '@argos/shared';
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
  /** Identidad estable: el mapa reinicia el trazado si cambia. */
  readonly guardarPoligono: (poligono: GeoJsonPolygon) => void;
  readonly cambiarOcupacion: (zona: ZonaPublica, nuevaOcupacion: number) => void;
  readonly cambiarEstadoRecurso: (recurso: Recurso, estado: EstadoRecurso) => void;
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

  const guardarPoligono = useCallback(
    (poligono: GeoJsonPolygon) => {
      const { incidentes: lista, seleccionadoId: id } = ultimo.current;
      const incidente = lista.find((i) => i.id === id);
      if (!incidente) {
        alAvisar('Selecciona un incidente para asignarle la zona de riesgo');
        return;
      }
      ejecutar(
        () =>
          servicio.actualizarIncidente(incidente.id, {
            geometria: poligono,
            timeline: agregarEvento(incidente.timeline, 'Zona de riesgo trazada por operador'),
          }),
        `Zona de riesgo guardada (${poligono.coordinates[0]?.length ?? 0} puntos)`,
      );
    },
    [servicio, ejecutar, alAvisar],
  );

  return useMemo<AccionesOperador>(
    () => ({
      guardarPoligono,
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
      cambiarOcupacion: (zona, nueva) => ejecutar(() => servicio.actualizarOcupacionZona(zona.id, nueva)),
      cambiarEstadoRecurso: (recurso, estado) =>
        ejecutar(() => {
          // Despachar usa el incidente seleccionado; otras transiciones lo conservan o liberan.
          const siguiente = transicionarRecurso(recurso, estado, ultimo.current.seleccionadoId ?? undefined);
          return servicio.cambiarEstadoRecurso(recurso.id, estado, siguiente.incidente_asignado_id);
        }),
    }),
    [servicio, ejecutar, alSeleccionar, guardarPoligono],
  );
}
