import {
  radiosParaTipo,
  radiosValidos,
  type Coordenadas,
  type EstadoSla,
  type GeoJsonPolygon,
  type GeometriaZona,
  type Incidente,
  type Llamada,
  type RecomendacionAsesor,
  type SnapshotAsesor,
  type ZonaPublica,
} from '@argos/shared';
import { analizarPerimetro } from './analisisEspacial';
import { codigoIncidente, minutosAbierto } from './cola';
import { aPosicion, distanciaM, ubicacionDeIncidente } from './geo';
import type { TokenColor } from './geojson';
import { generarAnillos, type AnilloGenerado } from './perimetro';
import type { UnidadMapa } from './unidadesMapa';

/** Largo máximo de la justificación (ROADMAP §5.5). */
export const MAX_JUSTIFICACION = 600;

export interface EntradaSnapshot {
  readonly incidente: Incidente;
  readonly llamadas: readonly Llamada[];
  /** Unidades con su posición actual (la interpolada si van en ruta). */
  readonly unidades: readonly UnidadMapa[];
  readonly zonas: readonly ZonaPublica[];
  /** SLA de las unidades con despacho en curso, por id de recurso. */
  readonly sla: ReadonlyMap<string, EstadoSla>;
  readonly ahoraMs: number;
}

/** Punto representativo de una zona: el propio punto o el centroide de sus vértices. */
function centroDe(geometria: GeometriaZona): Coordenadas {
  if (geometria.type === 'Point') return { lng: geometria.coordinates[0], lat: geometria.coordinates[1] };
  const vertices = geometria.type === 'Polygon' ? (geometria.coordinates[0] ?? []) : geometria.coordinates;
  if (vertices.length === 0) return { lng: 0, lat: 0 };
  const suma = vertices.reduce((acc, [lng, lat]) => ({ lng: acc.lng + lng, lat: acc.lat + lat }), { lng: 0, lat: 0 });
  return { lng: suma.lng / vertices.length, lat: suma.lat / vertices.length };
}

/**
 * Entrada del asesor a partir del estado de la consola (ROADMAP §5.4). No incluye al reportante ni su callback;
 * solo las unidades con ubicación que no están INOPERATIVAS, con la distancia al incidente ya calculada. Los refugios
 * y las unidades en zona caliente se analizan contra el perímetro de protocolo del tipo, que es el que el asesor propone.
 */
export function construirSnapshot({ incidente, llamadas, unidades, zonas, sla, ahoraMs }: EntradaSnapshot): SnapshotAsesor {
  const centro = ubicacionDeIncidente(incidente);
  const vinculadas = llamadas
    .filter((l) => l.incidenteId === incidente.id)
    .sort((a, b) => a.creadoEn.localeCompare(b.creadoEn));
  const narrativa = vinculadas[0]?.narrativa.trim();
  const anillos = generarAnillos(centro, radiosParaTipo(incidente.tipo));
  const analisis = analizarPerimetro(anillos, zonas, unidades, incidente.id);
  const operativas = unidades.filter((u) => u.estado !== 'INOPERATIVO');
  const idsOperativas = new Set(operativas.map((u) => u.id));
  return {
    version: 1,
    generadoEn: new Date(ahoraMs).toISOString(),
    incidente: {
      id: incidente.id,
      codigo: codigoIncidente(incidente.id),
      tipo: incidente.tipo,
      prioridad: incidente.prioridad,
      ubicacion: centro,
      descripcion: narrativa ? `${incidente.titulo}. ${narrativa}` : incidente.titulo,
      llamadasVinculadas: vinculadas.length,
      minutosAbierto: minutosAbierto(incidente, ahoraMs) ?? 0,
      perimetroActual: incidente.perimetro?.radios ?? null,
    },
    recursos: operativas.map((u) => ({
      id: u.id,
      indicativo: u.indicativo,
      tipo: u.tipo,
      estado: u.estado,
      incidenteId: u.incidenteId,
      ubicacion: u.posicion,
      distanciaM: Math.round(distanciaM(u.posicion, centro)),
    })),
    refugios: zonas
      .filter((z) => z.tipo === 'Refugio')
      .map((z) => ({
        id: z.id,
        nombre: z.nombre,
        ubicacion: centroDe(z.geometria),
        ocupacion: z.capacidad_actual,
        capacidad: z.capacidad_maxima,
        anillo: analisis.refugios.find((r) => r.id === z.id)?.anillo ?? 'FUERA',
      })),
    contexto: {
      slaVencidos: operativas.filter((u) => u.incidenteId === incidente.id && sla.get(u.id)?.nivel === 'VENCIDO').map((u) => u.id),
      unidadesEnZonaCaliente: analisis.unidadesEnZonaCaliente.filter((id) => idsOperativas.has(id)),
    },
  };
}

export type MotivoInvalido =
  | 'RECURSO_INEXISTENTE'
  | 'RECURSO_NO_DISPONIBLE'
  | 'RECURSO_REPETIDO'
  | 'ETA_INVALIDA'
  | 'RADIOS_NO_CRECIENTES'
  | 'REFUGIO_INEXISTENTE'
  | 'JUSTIFICACION_LARGA';

export type ValidacionRecomendacion =
  | { readonly valida: true }
  | { readonly valida: false; readonly motivo: MotivoInvalido; readonly detalle: string };

const invalida = (motivo: MotivoInvalido, detalle: string): ValidacionRecomendacion => ({ valida: false, motivo, detalle });

/**
 * Comprueba una recomendación contra el snapshot que la originó (ROADMAP §4.2): cada unidad debe existir y estar
 * DISPONIBLE (y no repetirse), los radios deben ser positivos y crecientes y el refugio, si hay, debe existir.
 * Una recomendación inválida se descarta entera: no se aplica nada.
 */
export function validarRecomendacion(snapshot: SnapshotAsesor, rec: RecomendacionAsesor): ValidacionRecomendacion {
  const vistas = new Set<string>();
  for (const u of rec.unidades) {
    const recurso = snapshot.recursos.find((r) => r.id === u.idRecurso);
    if (!recurso) return invalida('RECURSO_INEXISTENTE', u.idRecurso);
    if (recurso.estado !== 'DISPONIBLE') return invalida('RECURSO_NO_DISPONIBLE', u.idRecurso);
    if (vistas.has(u.idRecurso)) return invalida('RECURSO_REPETIDO', u.idRecurso);
    vistas.add(u.idRecurso);
    if (!Number.isFinite(u.etaMin) || u.etaMin < 0) return invalida('ETA_INVALIDA', u.idRecurso);
  }
  if (!radiosValidos(rec.perimetroSugerido)) return invalida('RADIOS_NO_CRECIENTES', JSON.stringify(rec.perimetroSugerido));
  if (rec.refugioSugeridoId !== null && !snapshot.refugios.some((r) => r.id === rec.refugioSugeridoId)) {
    return invalida('REFUGIO_INEXISTENTE', rec.refugioSugeridoId);
  }
  if (rec.justificacion.length > MAX_JUSTIFICACION) return invalida('JUSTIFICACION_LARGA', String(rec.justificacion.length));
  return { valida: true };
}

/** Una acción que el operador puede aceptar o rechazar por separado al aplicar la sugerencia. */
export type AccionAsesor =
  | { readonly tipo: 'DESPACHAR'; readonly idRecurso: string }
  | { readonly tipo: 'PERIMETRO' }
  | { readonly tipo: 'REFUGIO'; readonly idRefugio: string };

/** Identificador estable de la acción dentro de una recomendación (para marcarla en la confirmación). */
export const claveAccion = (a: AccionAsesor): string =>
  a.tipo === 'DESPACHAR' ? `despachar:${a.idRecurso}` : a.tipo === 'REFUGIO' ? `refugio:${a.idRefugio}` : 'perimetro';

/** Todas las acciones de una recomendación: despachar cada unidad, aplicar el perímetro y fijar el refugio. */
export function accionesDeRecomendacion(rec: RecomendacionAsesor): readonly AccionAsesor[] {
  return [
    ...rec.unidades.map((u): AccionAsesor => ({ tipo: 'DESPACHAR', idRecurso: u.idRecurso })),
    { tipo: 'PERIMETRO' },
    ...(rec.refugioSugeridoId ? [{ tipo: 'REFUGIO', idRefugio: rec.refugioSugeridoId } satisfies AccionAsesor] : []),
  ];
}

/**
 * Reparte las acciones de la recomendación entre aceptadas y rechazadas. Se acepta lo que el operador marcó, salvo
 * despachar una unidad que ya no está disponible (la ocupó otro puesto mientras decidía): esa queda rechazada.
 */
export function separarAcciones(
  rec: RecomendacionAsesor,
  marcadas: ReadonlySet<string>,
  disponibles: ReadonlySet<string>,
): { readonly aceptadas: readonly AccionAsesor[]; readonly rechazadas: readonly AccionAsesor[] } {
  const aceptadas: AccionAsesor[] = [];
  const rechazadas: AccionAsesor[] = [];
  for (const a of accionesDeRecomendacion(rec)) {
    const ejecutable = marcadas.has(claveAccion(a)) && (a.tipo !== 'DESPACHAR' || disponibles.has(a.idRecurso));
    (ejecutable ? aceptadas : rechazadas).push(a);
  }
  return { aceptadas, rechazadas };
}

const idCorto = (rec: RecomendacionAsesor): string => rec.idRecomendacion.slice(0, 8);

function describirAccion(a: AccionAsesor, snapshot: SnapshotAsesor, rec: RecomendacionAsesor): string {
  if (a.tipo === 'DESPACHAR') return `despachar ${snapshot.recursos.find((r) => r.id === a.idRecurso)?.indicativo ?? a.idRecurso}`;
  if (a.tipo === 'REFUGIO') return `refugio ${snapshot.refugios.find((r) => r.id === a.idRefugio)?.nombre ?? a.idRefugio}`;
  const { CALIENTE, TIBIA, EVACUACION } = rec.perimetroSugerido;
  return `perímetro ${CALIENTE}/${TIBIA}/${EVACUACION} m`;
}

/**
 * Línea de la bitácora del incidente (en español, como el resto de lo que escribe la consola): origen ASESOR, el id
 * de la recomendación y qué se aceptó y qué se rechazó. Sin acciones aceptadas es un descarte.
 */
export function textoBitacoraAsesor(
  snapshot: SnapshotAsesor,
  rec: RecomendacionAsesor,
  aceptadas: readonly AccionAsesor[],
  rechazadas: readonly AccionAsesor[],
): string {
  const lista = (acciones: readonly AccionAsesor[]): string =>
    acciones.length === 0 ? 'ninguna' : acciones.map((a) => describirAccion(a, snapshot, rec)).join(', ');
  const resultado =
    aceptadas.length === 0 ? 'descartó la sugerencia' : rechazadas.length === 0 ? 'aplicó la sugerencia' : 'aplicó la sugerencia en parte';
  return `Asesor táctico [${idCorto(rec)}] · el operador ${resultado}. Aceptado: ${lista(aceptadas)}. Rechazado: ${lista(rechazadas)}.`;
}

/** Autor con el que el asesor firma su entrada en la bitácora; indica quién confirmó. */
export const autorAsesor = (operador?: string): string => (operador ? `ASESOR · ${operador}` : 'ASESOR');

/** Token de color de lo que el asesor previsualiza en el mapa. */
export const COLOR_PREVISUALIZACION: TokenColor = 'action-secondary';

type Par = readonly [number, number];

export interface FeaturePrevisualizacion {
  readonly type: 'Feature';
  readonly geometry: GeoJsonPolygon | { readonly type: 'LineString'; readonly coordinates: readonly [Par, Par] };
  readonly properties: { readonly id: string; readonly color: string };
}

export interface FeatureCollectionPrevisualizacion {
  readonly type: 'FeatureCollection';
  readonly features: readonly FeaturePrevisualizacion[];
}

export interface PrevisualizacionAsesor {
  /** Los tres anillos del perímetro sugerido. */
  readonly perimetro: FeatureCollectionPrevisualizacion;
  /** Una línea de cada unidad recomendada al incidente. */
  readonly unidades: FeatureCollectionPrevisualizacion;
  readonly anillos: readonly AnilloGenerado[];
}

/** Lo que el mapa dibuja con trazo discontinuo mientras la tarjeta del asesor está abierta. */
export function previsualizarRecomendacion(snapshot: SnapshotAsesor, rec: RecomendacionAsesor): PrevisualizacionAsesor {
  const centro = snapshot.incidente.ubicacion;
  const anillos = generarAnillos(centro, rec.perimetroSugerido);
  return {
    anillos,
    perimetro: {
      type: 'FeatureCollection',
      features: anillos.map((a) => ({
        type: 'Feature',
        geometry: a.poligono,
        properties: { id: a.anillo, color: COLOR_PREVISUALIZACION },
      })),
    },
    unidades: {
      type: 'FeatureCollection',
      features: rec.unidades.flatMap((u): FeaturePrevisualizacion[] => {
        const recurso = snapshot.recursos.find((r) => r.id === u.idRecurso);
        if (!recurso) return [];
        return [
          {
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: [aPosicion(recurso.ubicacion), aPosicion(centro)] },
            properties: { id: u.idRecurso, color: COLOR_PREVISUALIZACION },
          },
        ];
      }),
    },
  };
}
