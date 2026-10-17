import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  agregarEvento,
  incidenteDesdeReporte,
  transicionarRecurso,
  zonaDesdeTrazado,
  type EstadoIncidente,
  type EstadoRecurso,
  type Incidente,
  type OrigenEventoRecurso,
  type PerimetroRiesgo,
  type RecomendacionAsesor,
  type Recurso,
  type Reporte,
  type SnapshotAsesor,
  type ZonaPublica,
} from '@argos/shared';
import { accionesDeRecomendacion, autorAsesor, separarAcciones, textoBitacoraAsesor } from '../domain/asesor';
import type { FiguraTrazada } from '../domain/trazado';
import { useTexto } from '../i18n/IdiomaProvider';
import type { ServicioMesa } from '../services/supabaseClient';

interface Opciones {
  readonly servicio: ServicioMesa;
  readonly incidentes: readonly Incidente[];
  readonly seleccionadoId: string | null;
  readonly alSeleccionar: (id: string) => void;
  readonly alAvisar: (mensaje: string | null) => void;
  /** Quien opera la consola; queda como autor de cada evento que se añade a la bitácora. */
  readonly operador?: string;
}

/** Una recomendación del asesor sobre un incidente, tal como la vio el operador. */
export interface SugerenciaAsesor {
  readonly incidente: Incidente;
  readonly snapshot: SnapshotAsesor;
  readonly recomendacion: RecomendacionAsesor;
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
  readonly cambiarEstadoRecurso: (recurso: Recurso, estado: EstadoRecurso, incidenteId?: string, origen?: OrigenEventoRecurso) => void;
  /**
   * Ejecuta solo las acciones que el operador marcó (claves de `claveAccion`): despachar cada unidad con la misma
   * función del despacho manual, guardar el perímetro y designar el refugio. Una sola línea de bitácora, de origen
   * ASESOR, deja el id de la recomendación y lo aceptado y rechazado.
   */
  readonly aplicarSugerenciaAsesor: (sugerencia: SugerenciaAsesor & { readonly marcadas: ReadonlySet<string>; readonly recursos: readonly Recurso[] }) => void;
  /** Rechaza toda la sugerencia: no cambia nada, solo queda en la bitácora. */
  readonly descartarSugerenciaAsesor: (sugerencia: SugerenciaAsesor) => void;
}

/** Casos de uso del operador sobre el servicio; los errores se muestran como aviso. */
export function useAccionesOperador({
  servicio,
  incidentes,
  seleccionadoId,
  alSeleccionar,
  alAvisar,
  operador,
}: Opciones): AccionesOperador {
  const { t } = useTexto();
  const ultimo = useRef({ incidentes, seleccionadoId });
  useEffect(() => {
    ultimo.current = { incidentes, seleccionadoId };
  });

  const ejecutar = useCallback(
    (tarea: () => Promise<unknown>, exito?: string) => {
      const mensajeDe = (err: unknown): string => (err instanceof Error ? err.message : t('aviso.errorDesconocido'));
      alAvisar(null);
      new Promise<unknown>((resolver) => resolver(tarea())).then(
        () => {
          if (exito) alAvisar(exito);
        },
        (err: unknown) => alAvisar(mensajeDe(err)),
      );
    },
    [alAvisar, t],
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
              timeline: agregarEvento(incidente.timeline, 'Zona de riesgo trazada por operador', new Date(), operador),
            }),
          t('aviso.zonaRiesgo.guardada', { titulo: incidente.titulo, n: figura.coordinates[0]?.length ?? 0 }),
        );
        return;
      }
      const zona = zonaDesdeTrazado(figura);
      ejecutar(() => servicio.crearZonaPublica(zona), t('aviso.zonaPublica.guardada', { nombre: zona.nombre }));
    },
    [servicio, ejecutar, operador, t],
  );

  const cambiarEstadoRecurso = useCallback(
    (recurso: Recurso, estado: EstadoRecurso, incidenteId?: string, origen?: OrigenEventoRecurso) =>
      ejecutar(() => {
        // Despachar usa el incidente indicado (o el seleccionado); otras transiciones lo conservan o liberan.
        const siguiente = transicionarRecurso(recurso, estado, incidenteId ?? ultimo.current.seleccionadoId ?? undefined);
        return origen
          ? servicio.cambiarEstadoRecurso(recurso.id, estado, siguiente.incidente_asignado_id, origen)
          : servicio.cambiarEstadoRecurso(recurso.id, estado, siguiente.incidente_asignado_id);
      }),
    [servicio, ejecutar],
  );

  const aplicarSugerenciaAsesor = useCallback<AccionesOperador['aplicarSugerenciaAsesor']>(
    ({ incidente, snapshot, recomendacion, marcadas, recursos }) => {
      const disponibles = new Set(recursos.filter((r) => r.estado_actual === 'DISPONIBLE').map((r) => r.id));
      const { aceptadas, rechazadas } = separarAcciones(recomendacion, marcadas, disponibles);
      for (const accion of aceptadas) {
        const recurso = accion.tipo === 'DESPACHAR' ? recursos.find((r) => r.id === accion.idRecurso) : undefined;
        if (recurso) cambiarEstadoRecurso(recurso, 'ASIGNADO', incidente.id, 'IA');
      }
      const perimetro: PerimetroRiesgo | null = aceptadas.some((a) => a.tipo === 'PERIMETRO')
        ? { centro: snapshot.incidente.ubicacion, radios: recomendacion.perimetroSugerido, origen: 'IA', poligonoManual: null }
        : null;
      ejecutar(
        () =>
          servicio.actualizarIncidente(incidente.id, {
            ...(perimetro ? { perimetro, perimetro_origen: perimetro.origen } : {}),
            timeline: agregarEvento(incidente.timeline, textoBitacoraAsesor(snapshot, recomendacion, aceptadas, rechazadas), new Date(), autorAsesor(operador)),
          }),
        t('aviso.asesor.aplicado', { n: aceptadas.length, total: aceptadas.length + rechazadas.length }),
      );
    },
    [servicio, ejecutar, cambiarEstadoRecurso, operador, t],
  );

  const descartarSugerenciaAsesor = useCallback<AccionesOperador['descartarSugerenciaAsesor']>(
    ({ incidente, snapshot, recomendacion }) =>
      ejecutar(
        () =>
          servicio.actualizarIncidente(incidente.id, {
            timeline: agregarEvento(
              incidente.timeline,
              textoBitacoraAsesor(snapshot, recomendacion, [], accionesDeRecomendacion(recomendacion)),
              new Date(),
              autorAsesor(operador),
            ),
          }),
        t('aviso.asesor.descartado'),
      ),
    [servicio, ejecutar, operador, t],
  );

  return useMemo<AccionesOperador>(
    () => ({
      guardarTrazado,
      confirmarReporte: (reporte) =>
        ejecutar(async () => {
          const nuevo = incidenteDesdeReporte(reporte);
          const incidente = await servicio.crearIncidente(
            operador ? { ...nuevo, timeline: nuevo.timeline.map((e) => ({ ...e, autor: operador })) } : nuevo,
          );
          await servicio.actualizarEstadoReporte(reporte.id, 'Confirmado');
          alSeleccionar(incidente.id);
        }),
      descartarReporte: (reporte) => ejecutar(() => servicio.actualizarEstadoReporte(reporte.id, 'Descartado')),
      cambiarEstadoIncidente: (incidente, estado) =>
        ejecutar(() =>
          servicio.actualizarIncidente(incidente.id, {
            estado,
            timeline: agregarEvento(incidente.timeline, `Estado cambiado a ${estado}`, new Date(), operador),
          }),
        ),
      cambiarOcupacion: (zona, delta) => ejecutar(() => servicio.ajustarOcupacionZona(zona.id, delta)),
      cambiarEstadoRecurso,
      aplicarSugerenciaAsesor,
      descartarSugerenciaAsesor,
    }),
    [servicio, ejecutar, alSeleccionar, guardarTrazado, operador, cambiarEstadoRecurso, aplicarSugerenciaAsesor, descartarSugerenciaAsesor],
  );
}
