import {
  PARAMETROS_DUPLICADOS,
  type CandidatoDuplicado,
  type Coordenadas,
  type Incidente,
  type ParametrosDuplicados,
  type TipoEmergencia,
} from '@argos/shared';
import { aperturaDeIncidente, codigoIncidente, estaCerrado } from './cola';
import { distanciaM, ubicacionDeIncidente } from './geo';

/** Tipos que suelen darse juntos o con el mismo origen: puntúan 0.5 en vez de 0. */
const FAMILIAS: readonly (readonly TipoEmergencia[])[] = [
  ['INCENDIO', 'FUGA_GAS'],
  ['CRECIENTE_SUBITA', 'INUNDACION'],
  ['DESLIZAMIENTO', 'VIA_BLOQUEADA'],
];

const PESOS = { proximidad: 0.5, recencia: 0.3, tipo: 0.2 } as const;

const MS_POR_MIN = 60_000;

/** 1 si es el mismo tipo, 0.5 si es de la misma familia, 0 en otro caso o si el incidente no tiene tipo. */
export function coincidenciaTipo(a: TipoEmergencia | null, b: TipoEmergencia | null): number {
  if (a === null || b === null) return 0;
  if (a === b) return 1;
  return FAMILIAS.some((f) => f.includes(a) && f.includes(b)) ? 0.5 : 0;
}

export interface ConsultaDuplicado {
  readonly tipo: TipoEmergencia;
  readonly ubicacion: Coordenadas;
}

/**
 * Incidentes no resueltos que probablemente describen la misma emergencia que la llamada, de mayor a menor
 * puntaje (a igual puntaje, el más cercano). `puntaje = 0.5·proximidad + 0.3·recencia + 0.2·coincidenciaTipo`.
 * La recencia mide el tiempo desde la apertura del incidente. Puro: la hora llega por parámetro.
 */
export function buscarDuplicados(
  consulta: ConsultaDuplicado,
  incidentes: readonly Incidente[],
  ahoraMs: number,
  parametros: ParametrosDuplicados = PARAMETROS_DUPLICADOS,
): readonly CandidatoDuplicado[] {
  const candidatos: CandidatoDuplicado[] = [];
  for (const incidente of incidentes) {
    if (estaCerrado(incidente)) continue;
    const distanciaM_ = distanciaM(consulta.ubicacion, ubicacionDeIncidente(incidente));
    if (distanciaM_ >= parametros.radioMaxM) continue;
    const apertura = aperturaDeIncidente(incidente);
    const minutosDesde = apertura === null ? parametros.ventanaMin : Math.max(0, (ahoraMs - apertura) / MS_POR_MIN);
    const puntaje =
      PESOS.proximidad * Math.max(0, 1 - distanciaM_ / parametros.radioMaxM) +
      PESOS.recencia * Math.max(0, 1 - minutosDesde / parametros.ventanaMin) +
      PESOS.tipo * coincidenciaTipo(consulta.tipo, incidente.tipo);
    if (puntaje < parametros.umbral) continue;
    candidatos.push({
      incidenteId: incidente.id,
      codigo: codigoIncidente(incidente.id),
      distanciaM: distanciaM_,
      minutosDesde: Math.floor(minutosDesde),
      puntaje,
    });
  }
  return candidatos
    .sort((a, b) => b.puntaje - a.puntaje || a.distanciaM - b.distanciaM || a.incidenteId.localeCompare(b.incidenteId))
    .slice(0, parametros.maxCandidatos);
}

/** "120 m" por debajo del kilómetro y "1.3 km" a partir de él. */
export function formatearDistancia(metros: number): string {
  return metros < 1000 ? `${Math.round(metros)} m` : `${(metros / 1000).toFixed(1)} km`;
}

/** "hace 4 min"; por debajo del minuto, "hace menos de 1 min". */
export const formatearHace = (minutos: number): string => (minutos < 1 ? 'hace menos de 1 min' : `hace ${Math.floor(minutos)} min`);

/** "120 m, hace 4 min": lo que el operador necesita para decidir si la llamada es del mismo incidente. */
export const describirCandidato = (c: Pick<CandidatoDuplicado, 'distanciaM' | 'minutosDesde'>): string =>
  `${formatearDistancia(c.distanciaM)}, ${formatearHace(c.minutosDesde)}`;
