import {
  PROTOCOLOS_PERIMETRO,
  type ConfianzaAsesor,
  type MotorAsesor,
  type RecomendacionAsesor,
  type ResultadoAsesor,
  type SnapshotAsesor,
  type TipoEmergencia,
  type TipoRecurso,
} from '@argos/shared';
import { textoTipoEmergencia, textoTipoRecurso } from '../i18n/etiquetas';
import type { Traductor } from '../i18n/IdiomaProvider';
import { MAX_JUSTIFICACION } from './asesor';
import { VELOCIDAD_MS } from './movimiento';

/**
 * Qué tipos de unidad requiere cada emergencia: uno de cada tipo listado. Son valores orientativos de partida (no un
 * protocolo oficial): la entidad debe validarlos y ajustarlos aquí.
 */
export const NECESIDADES_POR_TIPO: Readonly<Record<TipoEmergencia, readonly TipoRecurso[]>> = {
  INCENDIO: ['Bomberos', 'Ambulancia', 'Policía'],
  FUGA_GAS: ['Bomberos', 'Ambulancia'],
  CRECIENTE_SUBITA: ['Bomberos', 'Ambulancia', 'Policía'],
  INUNDACION: ['Bomberos', 'Ambulancia'],
  DESLIZAMIENTO: ['Bomberos', 'Policía', 'Ambulancia'],
  VIA_BLOQUEADA: ['Policía'],
};

/** Un refugio apto con esta fracción de su aforo ocupada se avisa como cercano al límite. */
export const UMBRAL_REFUGIO_LLENO = 0.8;

/** Confianza según la fracción de necesidades cubiertas: todas = ALTA, la mitad o más = MEDIA, menos = BAJA. */
export function confianzaPorCobertura(cubiertas: number, necesidades: number): ConfianzaAsesor {
  if (necesidades <= 0) return 'BAJA';
  const fraccion = cubiertas / necesidades;
  if (fraccion >= 1) return 'ALTA';
  return fraccion >= 0.5 ? 'MEDIA' : 'BAJA';
}

/** Minutos que tarda una unidad de ese tipo en recorrer `distanciaM` a su velocidad media (mínimo 1). */
export const etaMinutos = (tipo: TipoRecurso, distanciaM: number): number =>
  Math.max(1, Math.ceil(distanciaM / VELOCIDAD_MS[tipo] / 60));

export interface OpcionesMotorReglas {
  readonly t: Traductor;
  /** Id de la recomendación; por defecto un UUID. */
  readonly generarId?: () => string;
}

const recortar = (texto: string): string =>
  texto.length <= MAX_JUSTIFICACION ? texto : `${texto.slice(0, MAX_JUSTIFICACION - 1).trimEnd()}…`;

/**
 * Recomendación por reglas, determinista y síncrona. Para cada tipo de unidad que exige la emergencia
 * (`NECESIDADES_POR_TIPO`) propone la unidad DISPONIBLE más cercana, salvo que el incidente ya tenga una de ese tipo
 * asignada. El perímetro es el del protocolo del tipo y el refugio, uno fuera de los anillos con el mayor cupo libre.
 */
export function recomendarPorReglas(snapshot: SnapshotAsesor, { t, generarId = () => globalThis.crypto.randomUUID() }: OpcionesMotorReglas): ResultadoAsesor {
  const { incidente } = snapshot;
  const tipo = incidente.tipo;
  if (!tipo) return { ok: false, error: 'SIN_RECOMENDACION', detalle: t('asesor.detalle.sinTipo') };

  const necesidades = NECESIDADES_POR_TIPO[tipo];
  const nombre = (id: string): string => snapshot.recursos.find((r) => r.id === id)?.indicativo ?? id;
  const asignadas = snapshot.recursos.filter((r) => r.incidenteId === incidente.id && r.estado !== 'DISPONIBLE');
  const libres = snapshot.recursos
    .filter((r) => r.estado === 'DISPONIBLE')
    .sort((a, b) => a.distanciaM - b.distanciaM || a.indicativo.localeCompare(b.indicativo, 'es', { numeric: true }));

  const unidades: RecomendacionAsesor['unidades'][number][] = [];
  const sinDisponibles: TipoRecurso[] = [];
  let cubiertas = 0;
  for (const necesidad of necesidades) {
    if (asignadas.some((r) => r.tipo === necesidad)) {
      cubiertas++;
      continue;
    }
    const mejor = libres.find((r) => r.tipo === necesidad);
    if (!mejor) {
      sinDisponibles.push(necesidad);
      continue;
    }
    cubiertas++;
    unidades.push({ idRecurso: mejor.id, rol: t(`asesor.rol.${necesidad}`), etaMin: etaMinutos(necesidad, mejor.distanciaM) });
  }

  const perimetroSugerido = { ...PROTOCOLOS_PERIMETRO[tipo] };
  // Un refugio es apto fuera de la zona caliente y la tibia. Se prefiere uno fuera de todos los anillos; si no lo hay,
  // sirve el que está en el anillo de evacuación (con aviso). Entre iguales, el de más cupo libre.
  const libre = (r: SnapshotAsesor['refugios'][number]): number => r.capacidad - r.ocupacion;
  const aptos = snapshot.refugios.filter((r) => (r.anillo === 'FUERA' || r.anillo === 'EVACUACION') && libre(r) > 0);
  const refugio =
    [...aptos].sort(
      (a, b) =>
        Number(a.anillo !== 'FUERA') - Number(b.anillo !== 'FUERA') || libre(b) - libre(a) || a.nombre.localeCompare(b.nombre, 'es'),
    )[0] ?? null;

  const advertencias = [
    ...sinDisponibles.map((necesidad) => t('asesor.adv.sinUnidades', { tipo: textoTipoRecurso(t, necesidad) })),
    ...snapshot.contexto.unidadesEnZonaCaliente.map((id) => t('asesor.adv.zonaCaliente', { unidad: nombre(id) })),
    ...snapshot.contexto.slaVencidos.map((id) => t('asesor.adv.slaVencido', { unidad: nombre(id) })),
    ...(refugio ? [] : [t('asesor.adv.sinRefugio')]),
    ...(refugio?.anillo === 'EVACUACION' ? [t('asesor.adv.refugioEnEvacuacion', { refugio: refugio.nombre })] : []),
    ...snapshot.refugios
      .filter((r) => (r.anillo === 'FUERA' || r.anillo === 'EVACUACION') && r.capacidad > 0 && r.ocupacion / r.capacidad >= UMBRAL_REFUGIO_LLENO)
      .map((r) => t('asesor.adv.refugioLleno', { refugio: r.nombre, porcentaje: Math.round((r.ocupacion / r.capacidad) * 100) })),
  ];

  const radios = { caliente: perimetroSugerido.CALIENTE, tibia: perimetroSugerido.TIBIA, evacuacion: perimetroSugerido.EVACUACION };
  const justificacion = recortar(
    [
      t('asesor.just.situacion', {
        tipo: textoTipoEmergencia(t, tipo),
        prioridad: incidente.prioridad,
        minutos: incidente.minutosAbierto,
        llamadas: incidente.llamadasVinculadas,
      }),
      unidades.length > 0
        ? t('asesor.just.unidades', { unidades: unidades.map((u) => `${nombre(u.idRecurso)} (${u.rol})`).join(', ') })
        : t(sinDisponibles.length > 0 ? 'asesor.just.sinUnidades' : 'asesor.just.cubierto'),
      refugio
        ? t('asesor.just.perimetroRefugio', { ...radios, refugio: refugio.nombre, libres: refugio.capacidad - refugio.ocupacion })
        : t('asesor.just.perimetro', radios),
    ].join(' '),
  );

  return {
    ok: true,
    recomendacion: {
      idRecomendacion: generarId(),
      unidades,
      justificacion,
      perimetroSugerido,
      refugioSugeridoId: refugio?.id ?? null,
      advertencias,
      confianza: confianzaPorCobertura(cubiertas, necesidades.length),
    },
  };
}

/** El motor local del asesor: reglas fijas, sin red ni claves. Cambiarlo por un modelo de lenguaje es cambiar esta fábrica. */
export function crearMotorReglas(opciones: OpcionesMotorReglas): MotorAsesor {
  return { recomendar: (snapshot) => Promise.resolve(recomendarPorReglas(snapshot, opciones)) };
}
