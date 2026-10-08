import type { NuevaLlamada } from '@argos/shared';

/** Una llamada que el guion inyecta en el demo `tSeg` segundos después de arrancar el escenario. */
export interface EventoEscenario {
  readonly id: string;
  readonly tSeg: number;
  readonly llamada: NuevaLlamada;
}

export type Guion = readonly EventoEscenario[];

/** Duración del escenario de crisis (8 min). */
export const DURACION_ESCENARIO_SEG = 480;

/**
 * Crisis de ejemplo en Pasto: una fuga de gas que llega tres veces (dos llamadas duplicadas), un
 * deslizamiento y un aviso de sensor. Los puntos están a pocos metros entre sí cuando son del mismo evento.
 */
export const GUION_CRISIS: Guion = [
  {
    id: 'esc-gas-1',
    tSeg: 20,
    llamada: {
      canal: '123',
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      ubicacion: { lat: 1.2231, lng: -77.2862 },
      narrativa: 'Olor fuerte a gas en un edificio de apartamentos; los vecinos están saliendo.',
      reportante: 'Residente del edificio',
      callback: '3001112233',
    },
  },
  {
    id: 'esc-gas-2',
    tSeg: 75,
    llamada: {
      canal: 'VHF',
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      ubicacion: { lat: 1.2233, lng: -77.2859 },
      narrativa: 'Una patrulla reporta olor a gas en la misma cuadra y personas aglomeradas en la calle.',
      reportante: 'Patrulla P01',
      callback: null,
    },
  },
  {
    id: 'esc-gas-3',
    tSeg: 140,
    llamada: {
      canal: 'PRESENCIAL',
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      ubicacion: { lat: 1.2229, lng: -77.2864 },
      narrativa: 'Un comerciante llega a la estación: la fuga sigue y huele a gas en el local contiguo.',
      reportante: 'Comerciante del sector',
      callback: '3004445566',
    },
  },
  {
    id: 'esc-deslizamiento',
    tSeg: 230,
    llamada: {
      canal: '123',
      tipo: 'DESLIZAMIENTO',
      prioridad: 'P2',
      ubicacion: { lat: 1.2062, lng: -77.2704 },
      narrativa: 'Se desprendió parte de la ladera sobre la vía; hay tierra y piedras en la calzada.',
      reportante: 'Conductor',
      callback: '3007778899',
    },
  },
  {
    id: 'esc-sensor',
    tSeg: 380,
    llamada: {
      canal: 'SENSOR',
      tipo: 'CRECIENTE_SUBITA',
      prioridad: 'P2',
      ubicacion: { lat: 1.2091, lng: -77.2748 },
      narrativa: 'El sensor de nivel del río supera el umbral de alerta y sigue subiendo.',
      reportante: 'Sensor de nivel',
      callback: null,
    },
  },
];

/**
 * Unidad retenida por el tráfico: avanza a una fracción de su velocidad y su SLA de llegada vence hacia el minuto 5
 * del escenario a 1×. La consola anota el retraso en la bitácora del incidente `incidenteId` en `tSeg`.
 */
export const TRAFICO_ESCENARIO = {
  etiqueta: 'M12',
  /** Con 0,07 los 648 m de su base al incidente le llevan unos 11 min: llega hacia el minuto 7, ya fuera de SLA. */
  factorVelocidad: 0.07,
  incidenteId: 'demo-1',
  tSeg: 150,
  nota: 'Unidad M12 avanza con retraso por tráfico en la vía de acceso',
} as const;

/** Eventos con `tSeg` ≤ `tSeg`, en orden cronológico; un tiempo negativo no incluye ninguno. */
export function eventosHasta(guion: Guion, tSeg: number): Guion {
  return guion.filter((e) => e.tSeg <= tSeg).sort((a, b) => a.tSeg - b.tSeg);
}

/** Eventos aún no inyectados al pasar de `desdeSeg` (exclusivo) a `hastaSeg` (inclusivo). */
export function eventosEntre(guion: Guion, desdeSeg: number, hastaSeg: number): Guion {
  return eventosHasta(guion, hastaSeg).filter((e) => e.tSeg > desdeSeg);
}
