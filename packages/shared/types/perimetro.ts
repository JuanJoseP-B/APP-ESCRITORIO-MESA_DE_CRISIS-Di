import type { TipoEmergencia } from './emergencia';
import type { Coordenadas, GeoJsonPolygon } from './geo';

export const ANILLOS = ['CALIENTE', 'TIBIA', 'EVACUACION'] as const;
export type Anillo = (typeof ANILLOS)[number];

/** Metros desde el centro; estrictamente crecientes de CALIENTE a EVACUACION. */
export type RadiosPerimetro = Readonly<Record<Anillo, number>>;

export const RADIOS_POR_DEFECTO: RadiosPerimetro = { CALIENTE: 100, TIBIA: 300, EVACUACION: 500 };

/**
 * Radios por tipo de emergencia. Son valores orientativos de partida (no un protocolo oficial): la entidad
 * debe validarlos y ajustarlos aquí. Un incidente sin tipo usa `RADIOS_POR_DEFECTO`.
 */
export const PROTOCOLOS_PERIMETRO: Readonly<Record<TipoEmergencia, RadiosPerimetro>> = {
  INCENDIO: { CALIENTE: 100, TIBIA: 300, EVACUACION: 500 },
  FUGA_GAS: { CALIENTE: 100, TIBIA: 300, EVACUACION: 800 },
  CRECIENTE_SUBITA: { CALIENTE: 150, TIBIA: 400, EVACUACION: 800 },
  INUNDACION: { CALIENTE: 150, TIBIA: 400, EVACUACION: 800 },
  DESLIZAMIENTO: { CALIENTE: 50, TIBIA: 150, EVACUACION: 300 },
  VIA_BLOQUEADA: { CALIENTE: 50, TIBIA: 100, EVACUACION: 200 },
};

/** Radios que corresponden a un tipo; sin tipo (incidente anterior al CAD) se usan los de por defecto. */
export const radiosParaTipo = (tipo: TipoEmergencia | null): RadiosPerimetro =>
  tipo ? PROTOCOLOS_PERIMETRO[tipo] : RADIOS_POR_DEFECTO;

/** Radios positivos y estrictamente crecientes (CALIENTE < TIBIA < EVACUACION). */
export const radiosValidos = (r: RadiosPerimetro): boolean =>
  Number.isFinite(r.CALIENTE) && r.CALIENTE > 0 && r.TIBIA > r.CALIENTE && r.EVACUACION > r.TIBIA && Number.isFinite(r.EVACUACION);

export const ORIGENES_PERIMETRO = ['AUTO', 'MANUAL', 'IA'] as const;
export type OrigenPerimetro = (typeof ORIGENES_PERIMETRO)[number];

/** Se persiste en `incidentes.perimetro` (jsonb); el anillo exterior es además `incidentes.geometria`. */
export interface PerimetroRiesgo {
  readonly centro: Coordenadas;
  readonly radios: RadiosPerimetro;
  readonly origen: OrigenPerimetro;
  /** Polígono trazado a mano que sustituye al anillo EVACUACION; `null` si el perímetro es circular. */
  readonly poligonoManual: GeoJsonPolygon | null;
}

export interface AnalisisPerimetro {
  readonly refugios: ReadonlyArray<{
    readonly id: string;
    readonly nombre: string;
    readonly anillo: Anillo | 'FUERA';
    /** `false` si el refugio queda dentro de CALIENTE o TIBIA. */
    readonly apto: boolean;
  }>;
  /** Ids de recurso dentro de CALIENTE que no atienden este incidente: alerta de seguridad. */
  readonly unidadesEnZonaCaliente: readonly string[];
  /** Ids de recurso EN_ESCENA o EN_RUTA asignados al incidente y dentro de CALIENTE: es su lugar de trabajo, sin alerta. */
  readonly unidadesAsignadasEnZona: readonly string[];
  /** Ids de `zonas_publicas` (bloqueos) que intersectan algún anillo. */
  readonly bloqueosAfectados: readonly string[];
}
