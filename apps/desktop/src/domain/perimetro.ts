import circle from '@turf/circle';
import {
  ANILLOS,
  radiosParaTipo,
  type Anillo,
  type Coordenadas,
  type GeoJsonPolygon,
  type Incidente,
  type Posicion,
  type RadiosPerimetro,
} from '@argos/shared';
import { aPosicion, ubicacionDeIncidente } from './geo';
import type { TokenColor } from './geojson';

/** Vértices por circunferencia: con 500 m de radio el lado mide ~50 m y el anillo se ve redondo. */
const PASOS_ANILLO = 64;

/** Un anillo concéntrico del perímetro de riesgo. */
export interface AnilloGenerado {
  readonly anillo: Anillo;
  readonly radioM: number;
  readonly poligono: GeoJsonPolygon;
  /** Punto más al norte del anillo: ahí se fija su etiqueta. */
  readonly norte: Coordenadas;
}

export interface PerimetroGenerado {
  readonly centro: Coordenadas;
  readonly radios: RadiosPerimetro;
  /** De CALIENTE (el más interno) a EVACUACION. */
  readonly anillos: readonly AnilloGenerado[];
}

/** Anillos concéntricos con `@turf/circle` sobre `centro`. */
export function generarAnillos(centro: Coordenadas, radios: RadiosPerimetro): readonly AnilloGenerado[] {
  return ANILLOS.map((anillo) => {
    const radioM = radios[anillo];
    const { geometry } = circle(aPosicion(centro), radioM, { steps: PASOS_ANILLO, units: 'meters' });
    const poligono: GeoJsonPolygon = {
      type: 'Polygon',
      coordinates: geometry.coordinates.map((vertices) => vertices.map((p): Posicion => [p[0] ?? 0, p[1] ?? 0])),
    };
    // El primer vértice de turf es el rumbo 0: el norte.
    const [lng, lat] = poligono.coordinates[0]?.[0] ?? aPosicion(centro);
    return { anillo, radioM, poligono, norte: { lat, lng } };
  });
}

/**
 * Perímetro de un incidente: radios guardados en `perimetro` si los tiene; si no, los de `PROTOCOLOS_PERIMETRO` para
 * su tipo (100/300/500 m cuando no hay tipo). El centro es `ubicacionDeIncidente`.
 */
export function perimetroDeIncidente(incidente: Pick<Incidente, 'tipo' | 'perimetro' | 'geometria'>): PerimetroGenerado {
  const centro = ubicacionDeIncidente(incidente);
  const radios = incidente.perimetro?.radios ?? radiosParaTipo(incidente.tipo);
  return { centro, radios, anillos: generarAnillos(centro, radios) };
}

/** Color de los tres anillos (riesgo vital): se distinguen por opacidad, trazo y etiqueta, no solo por color. */
export const COLOR_ANILLO: TokenColor = 'status-critical';

/** Múltiplo de la opacidad base de zona: decrece hacia fuera para que lo más peligroso pese más. */
export const FACTOR_OPACIDAD_ANILLO: Readonly<Record<Anillo, number>> = { CALIENTE: 2, TIBIA: 1.2, EVACUACION: 0.6 };

export interface FeatureAnillo {
  readonly type: 'Feature';
  readonly id: Anillo;
  readonly geometry: GeoJsonPolygon;
  readonly properties: {
    readonly id: Anillo;
    readonly color: string;
    readonly opacidad: number;
    readonly radioM: number;
  };
}

export interface FeatureCollectionAnillos {
  readonly type: 'FeatureCollection';
  readonly features: readonly FeatureAnillo[];
}

/** `opacidadBase` es la de `opacidadZona()` del tema activo. */
export function anillosAFeatureCollection(anillos: readonly AnilloGenerado[], opacidadBase: number): FeatureCollectionAnillos {
  return {
    type: 'FeatureCollection',
    features: anillos.map((a) => ({
      type: 'Feature',
      id: a.anillo,
      geometry: a.poligono,
      properties: {
        id: a.anillo,
        color: COLOR_ANILLO,
        opacidad: Math.min(1, opacidadBase * FACTOR_OPACIDAD_ANILLO[a.anillo]),
        radioM: a.radioM,
      },
    })),
  };
}

/** «100 m», «1,2 km»: el radio tal como se rotula en el mapa. */
export function etiquetaRadio(radioM: number, idioma: string = 'es'): string {
  if (radioM < 1000) return `${radioM} m`;
  return `${new Intl.NumberFormat(idioma, { maximumFractionDigits: 1 }).format(radioM / 1000)} km`;
}
