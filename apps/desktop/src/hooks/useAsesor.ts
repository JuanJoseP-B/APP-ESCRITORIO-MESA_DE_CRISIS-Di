import { useCallback, useEffect, useRef, useState } from 'react';
import type { ErrorAsesor, MotorAsesor, RecomendacionAsesor, ResultadoAsesor, SnapshotAsesor } from '@argos/shared';
import { validarRecomendacion } from '../domain/asesor';

/** Cuánto dura el estado «analizando»: el motor de reglas responde al instante, pero el operador debe ver que se consulta. */
export const ESPERA_ANALISIS_MS = 600;

export type EstadoAsesor =
  | { readonly fase: 'inactivo' }
  | { readonly fase: 'analizando' }
  | { readonly fase: 'listo'; readonly snapshot: SnapshotAsesor; readonly recomendacion: RecomendacionAsesor }
  | { readonly fase: 'error'; readonly error: ErrorAsesor; readonly detalle: string };

const INACTIVO: EstadoAsesor = { fase: 'inactivo' };

export interface OpcionesAsesor {
  readonly motor: MotorAsesor;
  /** Incidente al que se refiere el asesor; si cambia (o pasa a `null`), la tarjeta se cierra. */
  readonly incidenteId: string | null;
  /** Arma el snapshot con el estado actual de la consola; `null` si no hay incidente. */
  readonly construir: () => SnapshotAsesor | null;
  readonly esperaMs?: number;
}

export interface Asesor {
  readonly estado: EstadoAsesor;
  /** Pide una recomendación nueva con el estado de ese momento. */
  readonly abrir: () => void;
  /** Cierra la tarjeta sin registrar nada y descarta la consulta en curso. */
  readonly cerrar: () => void;
  /** Abre si está cerrado y cierra si no (botón [ASESOR] y atajo A). */
  readonly alternar: () => void;
}

const mensajeDe = (err: unknown): string => (err instanceof Error ? err.message : String(err));

/**
 * Ciclo de la tarjeta del asesor: inactivo → analizando (≥ 600 ms) → listo o error. Una recomendación que no
 * pasa `validarRecomendacion` se trata como respuesta inválida y no se muestra. Nunca cambia el estado de la
 * consola: eso lo hace el operador al confirmar.
 */
export function useAsesor({ motor, incidenteId, construir, esperaMs = ESPERA_ANALISIS_MS }: OpcionesAsesor): Asesor {
  const [estado, setEstado] = useState<EstadoAsesor>(INACTIVO);
  const consulta = useRef(0);
  const vigentes = useRef({ motor, construir });
  vigentes.current = { motor, construir };

  const cerrar = useCallback(() => {
    consulta.current++;
    setEstado(INACTIVO);
  }, []);

  // La recomendación es de un incidente: al cambiar de incidente la tarjeta deja de tener sentido.
  useEffect(() => cerrar(), [incidenteId, cerrar]);
  useEffect(() => () => void consulta.current++, []);

  const abrir = useCallback(() => {
    const snapshot = vigentes.current.construir();
    if (!snapshot) return;
    const mia = ++consulta.current;
    setEstado({ fase: 'analizando' });
    const espera = new Promise<void>((resolver) => setTimeout(resolver, esperaMs));
    const respuesta: Promise<ResultadoAsesor> = Promise.resolve()
      .then(() => vigentes.current.motor.recomendar(snapshot))
      .catch((err: unknown): ResultadoAsesor => ({ ok: false, error: 'API', detalle: mensajeDe(err) }));
    void Promise.all([respuesta, espera]).then(([resultado]) => {
      if (mia !== consulta.current) return;
      if (!resultado.ok) {
        setEstado({ fase: 'error', error: resultado.error, detalle: resultado.detalle });
        return;
      }
      const validacion = validarRecomendacion(snapshot, resultado.recomendacion);
      setEstado(
        validacion.valida
          ? { fase: 'listo', snapshot, recomendacion: resultado.recomendacion }
          : { fase: 'error', error: 'RESPUESTA_INVALIDA', detalle: `${validacion.motivo}: ${validacion.detalle}` },
      );
    });
  }, [esperaMs]);

  const alternar = useCallback(() => (estado.fase === 'inactivo' ? abrir() : cerrar()), [estado.fase, abrir, cerrar]);

  return { estado, abrir, cerrar, alternar };
}
