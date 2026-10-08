import booleanIntersects from '@turf/boolean-intersects';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { ANILLOS, type AnalisisPerimetro, type Anillo, type GeometriaZona, type ZonaPublica } from '@argos/shared';
import { aPosicion } from './geo';
import type { AnilloGenerado } from './perimetro';
import type { UnidadMapa } from './unidadesMapa';

/** Un refugio en CALIENTE o TIBIA queda dentro de la zona de peligro: no puede recibir gente. */
const ANILLOS_NO_APTOS: readonly Anillo[] = ['CALIENTE', 'TIBIA'];

// Las geometrías del dominio son de solo lectura; turf las lee sin modificarlas.
type Geometry = Parameters<typeof booleanIntersects>[0];
type Polygon = Parameters<typeof booleanPointInPolygon>[1];
const aGeometriaTurf = (g: GeometriaZona): Geometry => g as unknown as Geometry;
const aPoligonoTurf = (a: AnilloGenerado): Polygon => a.poligono as unknown as Polygon;

/** Anillo más interno que toca la zona; `FUERA` si no toca ninguno. Las zonas con área cuentan en cuanto se solapan. */
function anilloDe(geometria: GeometriaZona, anillos: readonly AnilloGenerado[]): Anillo | 'FUERA' {
  for (const nombre of ANILLOS) {
    const anillo = anillos.find((a) => a.anillo === nombre);
    if (anillo && booleanIntersects(aGeometriaTurf(geometria), aPoligonoTurf(anillo))) return nombre;
  }
  return 'FUERA';
}

/** Una unidad EN_ESCENA o EN_RUTA asignada al incidente analizado trabaja dentro de su zona caliente: no es una alerta. */
const ESTADOS_EN_OPERACION: readonly UnidadMapa['estado'][] = ['EN_ESCENA', 'EN_RUTA'];

/**
 * Análisis espacial de un perímetro (ROADMAP §3.2): refugios clasificados por anillo (y si son aptos para recibir
 * gente), unidades dentro de la zona caliente y bloqueos que cruzan cualquier anillo. Las unidades que atienden
 * `incidenteId` y están en la zona caliente se separan de las que alertan.
 */
export function analizarPerimetro(
  anillos: readonly AnilloGenerado[],
  zonas: readonly ZonaPublica[],
  unidades: readonly UnidadMapa[],
  incidenteId: string | null = null,
): AnalisisPerimetro {
  const caliente = anillos.find((a) => a.anillo === 'CALIENTE');
  const enZona = caliente ? unidades.filter((u) => booleanPointInPolygon(aPosicion(u.posicion), aPoligonoTurf(caliente))) : [];
  const asignada = (u: UnidadMapa): boolean =>
    incidenteId !== null && u.incidenteId === incidenteId && ESTADOS_EN_OPERACION.includes(u.estado);
  const exterior = anillos.find((a) => a.anillo === 'EVACUACION');
  return {
    refugios: zonas
      .filter((z) => z.tipo === 'Refugio')
      .map((z) => {
        const anillo = anilloDe(z.geometria, anillos);
        return { id: z.id, nombre: z.nombre, anillo, apto: anillo === 'FUERA' || !ANILLOS_NO_APTOS.includes(anillo) };
      }),
    unidadesEnZonaCaliente: enZona.filter((u) => !asignada(u)).map((u) => u.id),
    unidadesAsignadasEnZona: enZona.filter(asignada).map((u) => u.id),
    bloqueosAfectados: exterior
      ? zonas
          .filter((z) => z.tipo === 'Bloqueo de Vía' && booleanIntersects(aGeometriaTurf(z.geometria), aPoligonoTurf(exterior)))
          .map((z) => z.id)
      : [],
  };
}

/** Lo que el operador señala en el panel de análisis y el mapa resalta: una unidad o una zona pública (refugio o bloqueo). */
export interface ObjetivoResaltado {
  readonly tipo: 'unidad' | 'zona';
  readonly id: string;
}
