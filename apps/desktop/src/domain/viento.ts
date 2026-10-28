/** Viento en superficie: velocidad y dirección DESDE la que sopla (convención meteorológica, 0° = norte). */
export interface Viento {
  readonly speedKmh: number;
  readonly fromDeg: number;
}

/**
 * TODO: dato real. Mock del demo hasta conectar una fuente meteorológica: suroeste a 14 km/h con una oscilación
 * lenta de ±2 km/h y ±6° a lo largo del escenario, para que la tarjeta se sienta «en vivo».
 */
export function vientoSimulado(tSeg: number): Viento {
  return {
    speedKmh: Math.round(14 + 2 * Math.sin(tSeg / 45)),
    fromDeg: Math.round(normalizar(224 + 6 * Math.sin(tSeg / 90))),
  };
}

const normalizar = (deg: number): number => ((deg % 360) + 360) % 360;

/** Hacia dónde sopla (y hacia dónde se desplaza una nube de gas): la dirección opuesta a la de origen. */
export const haciaDeg = (v: Pick<Viento, 'fromDeg'>): number => normalizar(v.fromDeg + 180);

const RUMBOS = [0, 1, 2, 3, 4, 5, 6, 7] as const;
/** Rumbo de 8 puntos: 0 = N, 1 = NE … 7 = NO. */
export type Rumbo = (typeof RUMBOS)[number];

/** Rumbo de 8 puntos más cercano a un ángulo. */
export function rumbo(deg: number): Rumbo {
  return RUMBOS[Math.round(normalizar(deg) / 45) % 8] ?? 0;
}
