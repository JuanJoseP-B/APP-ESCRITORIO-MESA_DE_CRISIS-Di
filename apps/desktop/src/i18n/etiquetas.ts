import {
  esTipoEmergencia,
  type CanalLlamada,
  type EstadoIncidente,
  type EstadoRecurso,
  type NivelCriticidad,
  type TipoRecurso,
} from '@argos/shared';
import type { Traductor } from './IdiomaProvider';
import type { ClaveTexto } from './es';

/** Etiquetas de los valores del dominio en el idioma activo (los valores guardados no cambian). */

const CLAVE_SEVERIDAD: Readonly<Record<NivelCriticidad, ClaveTexto>> = {
  Crítico: 'severidad.critico',
  Medio: 'severidad.medio',
  Bajo: 'severidad.bajo',
};

export const textoSeveridad = (t: Traductor, nivel: NivelCriticidad): string => t(CLAVE_SEVERIDAD[nivel]);

export const textoEstadoIncidente = (t: Traductor, estado: EstadoIncidente): string => t(`estadoIncidente.${estado}`);

export const textoEstadoRecurso = (t: Traductor, estado: EstadoRecurso): string => t(`estadoRecurso.${estado}`);

export const textoEstadoRecursoCorto = (t: Traductor, estado: EstadoRecurso): string => t(`estadoRecursoCorto.${estado}`);

export const textoAccionRecurso = (t: Traductor, estado: EstadoRecurso): string => t(`accionRecurso.${estado}`);

export const textoTipoRecurso = (t: Traductor, tipo: TipoRecurso): string => t(`tipoRecurso.${tipo}`);

export const textoCanal = (t: Traductor, canal: CanalLlamada): string => t(`canal.${canal}`);

/** Un tipo fuera del catálogo (fila antigua) se muestra tal cual. */
export const textoTipoEmergencia = (t: Traductor, tipo: string): string =>
  esTipoEmergencia(tipo) ? t(`tipoEmergencia.${tipo}`) : tipo;
