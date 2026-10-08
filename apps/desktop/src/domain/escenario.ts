import type { NuevaLlamada, ZonaPublica } from '@argos/shared';

/** Una llamada que el guion inyecta en el demo `tSeg` segundos después de arrancar el escenario. */
export interface EventoEscenario {
  readonly id: string;
  readonly tSeg: number;
  readonly llamada: NuevaLlamada;
}

export type Guion = readonly EventoEscenario[];

/** Duración de cada escenario (8 min). */
export const DURACION_ESCENARIO_SEG = 480;

const llamada = (
  canal: NuevaLlamada['canal'],
  tipo: NuevaLlamada['tipo'],
  prioridad: NuevaLlamada['prioridad'],
  lat: number,
  lng: number,
  narrativa: string,
  reportante: string | null,
  callback: string | null = null,
): NuevaLlamada => ({ canal, tipo, prioridad, ubicacion: { lat, lng }, narrativa, reportante, callback });

/**
 * Escenario A · crisis de ejemplo en Pasto: una fuga de gas que llega tres veces (dos llamadas duplicadas), un
 * deslizamiento y un aviso de sensor. Los puntos están a pocos metros entre sí cuando son del mismo evento.
 */
const GUION_A: Guion = [
  {
    id: 'esc-gas-1',
    tSeg: 20,
    llamada: llamada('123', 'FUGA_GAS', 'P1', 1.2136, -77.2811, 'Olor fuerte a gas en un edificio de apartamentos; los vecinos están saliendo.', 'Residente del edificio', '3001112233'),
  },
  {
    id: 'esc-gas-2',
    tSeg: 75,
    llamada: llamada('VHF', 'FUGA_GAS', 'P1', 1.2138, -77.2808, 'Una patrulla reporta olor a gas en la misma cuadra y personas aglomeradas en la calle.', 'Patrulla P01'),
  },
  {
    id: 'esc-gas-3',
    tSeg: 140,
    llamada: llamada('PRESENCIAL', 'FUGA_GAS', 'P1', 1.2134, -77.2813, 'Un comerciante llega a la estación: la fuga sigue y huele a gas en el local contiguo.', 'Comerciante del sector', '3004445566'),
  },
  {
    id: 'esc-deslizamiento',
    tSeg: 230,
    llamada: llamada('123', 'DESLIZAMIENTO', 'P2', 1.2062, -77.2704, 'Se desprendió parte de la ladera sobre la vía; hay tierra y piedras en la calzada.', 'Conductor', '3007778899'),
  },
  {
    id: 'esc-sensor',
    tSeg: 380,
    llamada: llamada('SENSOR', 'CRECIENTE_SUBITA', 'P2', 1.2091, -77.2748, 'El sensor de nivel del río supera el umbral de alerta y sigue subiendo.', 'Sensor de nivel'),
  },
];

/**
 * Escenario B · deslizamiento por lluvias: un deslizamiento sobre la vía a Genoy (con una segunda llamada del mismo
 * evento), una vía bloqueada, la creciente del río cercano y refugios que ya van casi llenos.
 */
const GUION_B: Guion = [
  {
    id: 'esc-desl-1',
    tSeg: 15,
    llamada: llamada('123', 'DESLIZAMIENTO', 'P2', 1.2062, -77.2704, 'Tras horas de lluvia se desprendió la ladera sobre la vía; hay tierra y piedras en la calzada.', 'Conductor', '3007778899'),
  },
  {
    id: 'esc-desl-2',
    tSeg: 60,
    llamada: llamada('VHF', 'DESLIZAMIENTO', 'P2', 1.2064, -77.2702, 'Una patrulla confirma el deslizamiento: hay un vehículo detenido al borde y personas a pie.', 'Patrulla P01'),
  },
  {
    id: 'esc-via-1',
    tSeg: 110,
    llamada: llamada('PRESENCIAL', 'VIA_BLOQUEADA', 'P3', 1.2108, -77.2736, 'Un vecino avisa en la estación: el derrumbe cortó el único acceso al barrio alto.', 'Vecino del barrio alto', '3012223344'),
  },
  {
    id: 'esc-creciente',
    tSeg: 190,
    llamada: llamada('SENSOR', 'CRECIENTE_SUBITA', 'P2', 1.2091, -77.2748, 'El sensor de nivel del río supera el umbral de alerta y sigue subiendo.', 'Sensor de nivel'),
  },
  {
    id: 'esc-inundacion',
    tSeg: 270,
    llamada: llamada('123', 'INUNDACION', 'P2', 1.2086, -77.2745, 'El río se desbordó junto al puente; el agua entra en las casas de la ribera.', 'Residente de la ribera', '3015556677'),
  },
  {
    id: 'esc-desl-3',
    tSeg: 360,
    llamada: llamada('123', 'DESLIZAMIENTO', 'P2', 1.2024, -77.2655, 'Otro deslizamiento más arriba, sobre unas viviendas; se oyen gritos pidiendo ayuda.', 'Residente', '3019990011'),
  },
];

/**
 * Escenario C · incidentes simultáneos: un incendio, una fuga de gas, un deslizamiento y una inundación en menos de
 * tres minutos, todos a pocas cuadras de las mismas bases: no alcanzan las unidades para todos.
 */
const GUION_C: Guion = [
  {
    id: 'esc-inc-1',
    tSeg: 15,
    llamada: llamada('123', 'INCENDIO', 'P1', 1.215, -77.2795, 'Incendio en una bodega de reciclaje; sale humo negro y hay material inflamable.', 'Vigilante de la bodega', '3001230001'),
  },
  {
    id: 'esc-gas-1',
    tSeg: 45,
    llamada: llamada('VHF', 'FUGA_GAS', 'P1', 1.2118, -77.2832, 'Una patrulla huele gas fuerte frente a un restaurante; hay clientes adentro.', 'Patrulla P01'),
  },
  {
    id: 'esc-inc-2',
    tSeg: 70,
    llamada: llamada('PRESENCIAL', 'INCENDIO', 'P1', 1.2152, -77.2797, 'Una persona llega a la estación: el fuego ya pasó a la bodega vecina.', 'Transeúnte', '3001230002'),
  },
  {
    id: 'esc-desl-1',
    tSeg: 105,
    llamada: llamada('123', 'DESLIZAMIENTO', 'P2', 1.2175, -77.2745, 'Cayó parte del talud sobre una casa del barrio; hay una familia atrapada.', 'Vecino', '3001230003'),
  },
  {
    id: 'esc-gas-2',
    tSeg: 140,
    llamada: llamada('123', 'FUGA_GAS', 'P1', 1.212, -77.283, 'Se siente olor a gas en todo el local y a cuadra y media.', 'Cliente del restaurante', '3001230004'),
  },
  {
    id: 'esc-inund-1',
    tSeg: 190,
    llamada: llamada('SENSOR', 'INUNDACION', 'P2', 1.2095, -77.277, 'El sensor de la quebrada marca desbordamiento sobre la vía principal.', 'Sensor de nivel'),
  },
];

/** Unidad retenida del escenario: avanza a una fracción de su velocidad y la consola lo anota en la bitácora. */
export interface RetrasoUnidad {
  /** Indicativo de la unidad retenida. */
  readonly etiqueta: string;
  readonly factorVelocidad: number;
  /** Desde cuándo (segundos del escenario) se anota el retraso, en cuanto la unidad va EN_RUTA. */
  readonly tSeg: number;
  readonly nota: string;
}

/**
 * Escenario A: la M12 queda retenida por el tráfico. Con 0,07 los 648 m de su base a la fuga le llevan unos 11 min:
 * llega ya fuera del SLA de 10 min de una prioridad P1.
 */
export const TRAFICO_ESCENARIO: RetrasoUnidad = {
  etiqueta: 'M12',
  factorVelocidad: 0.07,
  tSeg: 150,
  nota: 'Unidad M12 avanza con retraso por tráfico en la vía de acceso',
};

const refugio = (n: number, nombre: string, lng: number, lat: number, actual: number, maxima: number): ZonaPublica => ({
  id: `demo-z${n}`,
  tipo: 'Refugio',
  nombre,
  geometria: { type: 'Point', coordinates: [lng, lat] },
  capacidad_actual: actual,
  capacidad_maxima: maxima,
});

/** Refugios de partida de los escenarios A y C. */
const ZONAS_BASE: readonly ZonaPublica[] = [
  refugio(1, 'Coliseo Municipal', -77.283, 1.215, 45, 200),
  refugio(2, 'Colegio Central', -77.279, 1.211, 10, 120),
];

/** Refugios presionados y el tramo de vía ya cortado del escenario B. */
const ZONAS_B: readonly ZonaPublica[] = [
  refugio(1, 'Coliseo Municipal', -77.283, 1.215, 168, 200),
  refugio(2, 'Colegio Central', -77.279, 1.211, 112, 120),
  refugio(3, 'Salón Comunal Lorenzo', -77.2735, 1.2085, 66, 80),
  {
    id: 'demo-z4',
    tipo: 'Bloqueo de Vía',
    nombre: 'Vía a Genoy, km 3',
    geometria: {
      type: 'LineString',
      coordinates: [
        [-77.2712, 1.2068],
        [-77.2697, 1.2058],
      ],
    },
    capacidad_actual: 0,
    capacidad_maxima: 0,
  },
];

export const IDS_ESCENARIO = ['A', 'B', 'C'] as const;
export type IdEscenario = (typeof IDS_ESCENARIO)[number];

/** Un escenario del demo: lo que llega por llamada, los refugios de partida y la unidad retenida (si la hay). */
export interface Escenario {
  readonly id: IdEscenario;
  readonly guion: Guion;
  readonly zonas: readonly ZonaPublica[];
  readonly retraso: RetrasoUnidad | null;
}

export const ESCENARIOS: Readonly<Record<IdEscenario, Escenario>> = {
  A: { id: 'A', guion: GUION_A, zonas: ZONAS_BASE, retraso: TRAFICO_ESCENARIO },
  B: { id: 'B', guion: GUION_B, zonas: ZONAS_B, retraso: null },
  C: { id: 'C', guion: GUION_C, zonas: ZONAS_BASE, retraso: null },
};

export const ESCENARIO_INICIAL: IdEscenario = 'A';

/** Guion del escenario A (la crisis por defecto). */
export const GUION_CRISIS: Guion = GUION_A;

/** Eventos con `tSeg` ≤ `tSeg`, en orden cronológico; un tiempo negativo no incluye ninguno. */
export function eventosHasta(guion: Guion, tSeg: number): Guion {
  return guion.filter((e) => e.tSeg <= tSeg).sort((a, b) => a.tSeg - b.tSeg);
}

/** Eventos aún no inyectados al pasar de `desdeSeg` (exclusivo) a `hastaSeg` (inclusivo). */
export function eventosEntre(guion: Guion, desdeSeg: number, hastaSeg: number): Guion {
  return eventosHasta(guion, hastaSeg).filter((e) => e.tSeg > desdeSeg);
}
