import type { ClaveTexto } from '../i18n/es';
import type { ParamsTexto } from '../i18n/idioma';
import type { CargaLista, EstadoEnlace } from './conexion';

export const LINEAS_ARRANQUE = ['argos', 'enlace', 'unidades', 'refugios', 'mapa'] as const;
export type IdLineaArranque = (typeof LINEAS_ARRANQUE)[number];

export type EstadoMapa = 'CARGANDO' | 'LISTO' | 'ERROR';
export type ResultadoArranque = 'OK' | 'PENDIENTE' | 'ERROR';

/** Lo que la consola sabe de cada subsistema mientras arranca: sale del servicio y del mapa, no se inventa. */
export interface SubsistemasArranque {
  readonly enlace: EstadoEnlace;
  readonly unidades: CargaLista & { readonly disponibles: number; readonly total: number };
  readonly refugios: CargaLista & { readonly activos: number };
  readonly mapa: EstadoMapa;
}

export interface LineaArranque {
  readonly id: IdLineaArranque;
  readonly resultado: ResultadoArranque;
  /** Texto del resultado, para `t()`. */
  readonly detalle: ClaveTexto;
  readonly params?: ParamsTexto;
}

/**
 * Ritmo de la secuencia: cada línea aparece en un tic par y muestra su resultado en el impar siguiente,
 * así que entra una línea cada 350 ms. La secuencia no se cierra sola: espera al operador.
 */
export const TIC_ARRANQUE_MS = 175;
export const TICS_ARRANQUE = LINEAS_ARRANQUE.length * 2;

/** `true` cuando la última línea ya mostró su resultado: es el momento de ofrecer la entrada a la consola. */
export const arranqueCompleto = (tic: number): boolean => tic >= TICS_ARRANQUE - 1;

export type FaseLinea = 'oculta' | 'comprobando' | 'resuelta';

export function faseLinea(indice: number, tic: number): FaseLinea {
  if (tic < indice * 2) return 'oculta';
  return tic === indice * 2 ? 'comprobando' : 'resuelta';
}

const RESULTADO_ENLACE: Readonly<Record<EstadoEnlace, ResultadoArranque>> = { EN_VIVO: 'OK', CONECTANDO: 'PENDIENTE', SIN_ENLACE: 'ERROR' };
const RESULTADO_MAPA: Readonly<Record<EstadoMapa, ResultadoArranque>> = { LISTO: 'OK', CARGANDO: 'PENDIENTE', ERROR: 'ERROR' };
const DETALLE_MAPA: Readonly<Record<EstadoMapa, ClaveTexto>> = { LISTO: 'arranque.mapa.ok', CARGANDO: 'arranque.pendiente', ERROR: 'arranque.mapa.error' };

/** El error prevalece sobre la carga: una lista que falló no está «cargando». */
function deLista(id: IdLineaArranque, lista: CargaLista, error: ClaveTexto, ok: Pick<LineaArranque, 'detalle' | 'params'>): LineaArranque {
  if (lista.error !== null) return { id, resultado: 'ERROR', detalle: error };
  if (lista.cargando) return { id, resultado: 'PENDIENTE', detalle: 'arranque.pendiente' };
  return { id, resultado: 'OK', ...ok };
}

/** Una línea por subsistema, en el orden de `LINEAS_ARRANQUE`. Si la consola está pintando, ARGOS arrancó. */
export function lineasArranque(s: SubsistemasArranque): readonly LineaArranque[] {
  return [
    { id: 'argos', resultado: 'OK', detalle: 'arranque.argos.ok' },
    { id: 'enlace', resultado: RESULTADO_ENLACE[s.enlace], detalle: `enlace.${s.enlace}` },
    deLista('unidades', s.unidades, 'arranque.unidades.error', {
      detalle: 'arranque.unidades.conteo',
      params: { disponibles: s.unidades.disponibles, total: s.unidades.total },
    }),
    deLista('refugios', s.refugios, 'arranque.refugios.error', { detalle: 'arranque.refugios.conteo', params: { activos: s.refugios.activos } }),
    { id: 'mapa', resultado: RESULTADO_MAPA[s.mapa], detalle: DETALLE_MAPA[s.mapa] },
  ];
}
