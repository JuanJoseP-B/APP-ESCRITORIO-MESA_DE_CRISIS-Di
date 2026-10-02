import { useEffect, useState } from 'react';
import { aplicarCambio, type CambioRealtime } from '../domain/realtime';
import type { ServicioMesa } from '../services/supabaseClient';
import type { Incidente, Recurso, Reporte } from '@argos/shared';

export interface EstadoLista<T> {
  readonly datos: readonly T[];
  readonly cargando: boolean;
  readonly error: string | null;
}

/** Carga inicial + cambios en tiempo real, con limpieza al desmontar. */
export function useListaRealtime<T extends { readonly id: string }>(
  cargar: () => Promise<readonly T[]>,
  suscribir: (alCambiar: (cambio: CambioRealtime<T>) => void) => () => void,
): EstadoLista<T> {
  const [estado, setEstado] = useState<EstadoLista<T>>({ datos: [], cargando: true, error: null });

  useEffect(() => {
    let activo = true;
    const cancelar = suscribir((cambio) => {
      if (activo) setEstado((e) => ({ ...e, datos: aplicarCambio(e.datos, cambio) }));
    });
    cargar().then(
      (datos) => {
        if (activo) setEstado((e) => ({ datos: mezclar(datos, e.datos), cargando: false, error: null }));
      },
      (err: unknown) => {
        if (activo) {
          setEstado((e) => ({
            ...e,
            cargando: false,
            error: err instanceof Error ? err.message : 'Error desconocido',
          }));
        }
      },
    );
    return () => {
      activo = false;
      cancelar();
    };
  }, [cargar, suscribir]);

  return estado;
}

/** Los cambios recibidos antes de terminar la carga inicial prevalecen sobre ella. */
function mezclar<T extends { readonly id: string }>(
  inicial: readonly T[],
  recibidos: readonly T[],
): readonly T[] {
  const ids = new Set(recibidos.map((x) => x.id));
  return [...inicial.filter((x) => !ids.has(x.id)), ...recibidos];
}

export const useIncidentesRealtime = (s: ServicioMesa): EstadoLista<Incidente> =>
  useListaRealtime(s.listarIncidentes, s.suscribirIncidentes);

export const useReportesRealtime = (s: ServicioMesa): EstadoLista<Reporte> =>
  useListaRealtime(s.listarReportes, s.suscribirReportes);

export const useRecursosRealtime = (s: ServicioMesa): EstadoLista<Recurso> =>
  useListaRealtime(s.listarRecursos, s.suscribirRecursos);
