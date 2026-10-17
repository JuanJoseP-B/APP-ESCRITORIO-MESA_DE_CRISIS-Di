import { useEffect, useRef } from 'react';
import type { Incidente, Llamada, Recurso } from '@argos/shared';
import { instantaneaSonora, sonidosDeCambios, type InstantaneaSonora } from '../domain/sonidos';
import { reproductor, type ReproductorSonidos } from '../services/reproductorSonidos';

interface Opciones {
  /** `false` mientras las listas cargan: lo que llega con la carga inicial es la base y no suena. */
  readonly listo: boolean;
  /** Llamadas en la bandeja de entrantes. */
  readonly entrantes: readonly Llamada[];
  readonly unidadesVencidas: readonly string[];
  readonly recursos: readonly Recurso[];
  readonly incidentes: readonly Incidente[];
}

/** Hace sonar lo que cambia en la consola: llamada nueva (según prioridad), SLA vencido, despacho e incidente resuelto. */
export function useSonidosConsola({ listo, entrantes, unidadesVencidas, recursos, incidentes }: Opciones, salida: ReproductorSonidos = reproductor): void {
  const previa = useRef<InstantaneaSonora | null>(null);
  useEffect(() => {
    if (!listo) return;
    const actual = instantaneaSonora({ entrantes, unidadesVencidas, recursos, incidentes });
    for (const sonido of sonidosDeCambios(previa.current, actual)) salida.reproducir(sonido);
    previa.current = actual;
  }, [listo, entrantes, unidadesVencidas, recursos, incidentes, salida]);
}
