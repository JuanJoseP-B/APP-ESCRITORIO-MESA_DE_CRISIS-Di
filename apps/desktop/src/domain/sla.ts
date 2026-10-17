import {
  SLA_POR_PRIORIDAD,
  type EstadoSla,
  type EventoRecurso,
  type Incidente,
  type NivelSla,
  type Prioridad,
  type Recurso,
} from '@argos/shared';
import { estaCerrado } from './cola';

/** De menor a mayor gravedad: el contador de la barra de estado toma el nivel más alto presente. */
const GRAVEDAD: Readonly<Record<NivelSla, number>> = { NO_APLICA: 0, EN_TIEMPO: 1, ALERTA: 2, VENCIDO: 3 };

const sinSla = (recursoId: string): EstadoSla => ({ recursoId, hito: null, transcurridoSeg: 0, limiteSeg: null, nivel: 'NO_APLICA' });

/**
 * SLA de una unidad (ROADMAP §3.3), función pura de sus eventos: el cronómetro arranca en el último paso a
 * ASIGNADO y espera EN_RUTA (límite `aEnRutaSeg`) y después EN_ESCENA (límite `aEnEscenaSeg`, también desde la
 * asignación). Pasa a ALERTA al alcanzar `alertaPrevia` del límite y a VENCIDO al superarlo. Si la unidad ya
 * llegó, se canceló el despacho o quedó inoperativa, el SLA no aplica.
 */
export function calcularSla(
  recursoId: string,
  eventos: readonly EventoRecurso[],
  prioridad: Prioridad,
  ahoraMs: number,
): EstadoSla {
  const propios = eventos
    .filter((e) => e.recursoId === recursoId)
    .map((e) => ({ hacia: e.hacia, ms: Date.parse(e.creadoEn) }))
    .filter((e) => Number.isFinite(e.ms))
    .sort((a, b) => a.ms - b.ms);
  const inicio = propios.map((e) => e.hacia).lastIndexOf('ASIGNADO');
  const asignado = propios[inicio];
  if (!asignado) return sinSla(recursoId);

  const despues = new Set(propios.slice(inicio + 1).map((e) => e.hacia));
  if (despues.has('EN_ESCENA') || despues.has('DISPONIBLE') || despues.has('INOPERATIVO')) return sinSla(recursoId);

  const umbral = SLA_POR_PRIORIDAD[prioridad];
  const hito = despues.has('EN_RUTA') ? 'EN_ESCENA' : 'EN_RUTA';
  const limiteSeg = hito === 'EN_RUTA' ? umbral.aEnRutaSeg : umbral.aEnEscenaSeg;
  const transcurridoSeg = Math.max(0, (ahoraMs - asignado.ms) / 1000);
  const nivel: NivelSla =
    transcurridoSeg > limiteSeg ? 'VENCIDO' : transcurridoSeg >= limiteSeg * umbral.alertaPrevia ? 'ALERTA' : 'EN_TIEMPO';
  return { recursoId, hito, transcurridoSeg, limiteSeg, nivel };
}

/**
 * SLA de cada unidad con un despacho en curso (ASIGNADO o EN_RUTA), por id de recurso. La prioridad sale del
 * incidente asignado; las demás unidades no aparecen (su SLA no aplica).
 */
export function slaDeRecursos(
  recursos: readonly Recurso[],
  eventos: readonly EventoRecurso[],
  incidentes: readonly Incidente[],
  ahoraMs: number,
): ReadonlyMap<string, EstadoSla> {
  const mapa = new Map<string, EstadoSla>();
  for (const r of recursos) {
    if (r.estado_actual !== 'ASIGNADO' && r.estado_actual !== 'EN_RUTA') continue;
    const incidente = incidentes.find((i) => i.id === r.incidente_asignado_id);
    // Un incidente resuelto ya no corre contra el reloj: aunque quede una unidad asignada, no cuenta como vencida.
    if (!incidente || estaCerrado(incidente)) continue;
    const estado = calcularSla(r.id, eventos, incidente.prioridad, ahoraMs);
    if (estado.nivel !== 'NO_APLICA') mapa.set(r.id, estado);
  }
  return mapa;
}

export interface ResumenSla {
  readonly vencidos: number;
  readonly alertas: number;
  /** Nivel más grave presente; `NO_APLICA` si no hay ninguna unidad con SLA en curso. */
  readonly nivel: NivelSla;
  /** Incidentes con al menos una unidad en ALERTA o VENCIDO: los que muestra el filtro de la cola. */
  readonly incidentesEnRiesgo: ReadonlySet<string>;
  /** Ids de las unidades con el SLA vencido, para anunciar cada vencimiento nuevo. */
  readonly unidadesVencidas: readonly string[];
}

/** Cuenta cuántas unidades están en ALERTA o VENCIDO y qué incidentes tienen alguna. */
export function resumirSla(recursos: readonly Recurso[], estados: ReadonlyMap<string, EstadoSla>): ResumenSla {
  let vencidos = 0;
  let alertas = 0;
  let nivel: NivelSla = 'NO_APLICA';
  const incidentesEnRiesgo = new Set<string>();
  const unidadesVencidas: string[] = [];
  for (const r of recursos) {
    const e = estados.get(r.id);
    if (!e) continue;
    if (e.nivel === 'VENCIDO') {
      vencidos++;
      unidadesVencidas.push(r.id);
    } else if (e.nivel === 'ALERTA') alertas++;
    if ((e.nivel === 'VENCIDO' || e.nivel === 'ALERTA') && r.incidente_asignado_id) incidentesEnRiesgo.add(r.incidente_asignado_id);
    if (GRAVEDAD[e.nivel] > GRAVEDAD[nivel]) nivel = e.nivel;
  }
  return { vencidos, alertas, nivel, incidentesEnRiesgo, unidadesVencidas };
}

/** Ids que están vencidos ahora y no lo estaban antes: lo que hay que anunciar. */
export function vencimientosNuevos(antes: ReadonlySet<string>, ahora: readonly string[]): readonly string[] {
  return ahora.filter((id) => !antes.has(id));
}

/** `mm:ss` de una duración en segundos (minutos sin tope: 75 min → «75:00»); lo negativo cuenta como cero. */
export function formatearCronometro(segundos: number): string {
  const total = Math.floor(Math.max(0, segundos));
  const mm = Math.floor(total / 60);
  const ss = total % 60;
  return `${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
