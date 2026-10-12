import { CLAVE_IDIOMA, IDIOMA_POR_DEFECTO, esIdioma, type Idioma } from '../i18n/idioma';
import { CLAVE_TEMA, aplicarTema, esTemaPreferido, resolverTema, type TemaPreferido } from '../tema';
import { VOLUMEN_POR_DEFECTO, normalizarVolumen } from './sonidos';

/** Ajustes del operador que sobreviven al reinicio. */
export interface Preferencias {
  readonly tema: TemaPreferido;
  readonly idioma: Idioma;
  /** Apaga transiciones y animaciones aunque el sistema no lo pida. */
  readonly reducirMovimiento: boolean;
  /** Escala la tipografía con el token `--escala-texto`. */
  readonly textoGrande: boolean;
  /** Muestra la secuencia de diagnóstico al iniciar sesión. */
  readonly mostrarArranque: boolean;
  /** Sonidos de la consola; apagado es el silencio (también desde la barra de estado). */
  readonly sonido: boolean;
  /** De 0 a 100. */
  readonly volumen: number;
}

export const PREFERENCIAS_POR_DEFECTO: Preferencias = {
  tema: 'crema',
  idioma: IDIOMA_POR_DEFECTO,
  reducirMovimiento: false,
  textoGrande: false,
  mostrarArranque: true,
  sonido: true,
  volumen: VOLUMEN_POR_DEFECTO,
};

export const CLAVE_REDUCIR_MOVIMIENTO = 'argos.reducirMovimiento';
export const CLAVE_TEXTO_GRANDE = 'argos.textoGrande';
export const CLAVE_MOSTRAR_ARRANQUE = 'argos.mostrarArranque';
export const CLAVE_SONIDO = 'argos.sonido';
export const CLAVE_VOLUMEN = 'argos.volumen';

/** Una clave que falla o trae basura no tumba a las demás. */
function leer(clave: string): string | null {
  try {
    return localStorage.getItem(clave);
  } catch {
    return null;
  }
}

function escribir(clave: string, valor: string): void {
  try {
    localStorage.setItem(clave, valor);
  } catch {
    /* sin persistencia: las preferencias siguen aplicadas en esta sesión */
  }
}

const leerBooleano = (clave: string, porDefecto: boolean): boolean => {
  const v = leer(clave);
  return v === 'true' ? true : v === 'false' ? false : porDefecto;
};

/** Solo dígitos: `''`, `'alto'` o `'1e3'` no son un volumen guardado. */
const leerVolumen = (): number => {
  const v = leer(CLAVE_VOLUMEN);
  return v !== null && /^\d{1,3}$/.test(v) ? normalizarVolumen(Number(v)) : PREFERENCIAS_POR_DEFECTO.volumen;
};

export function leerPreferencias(): Preferencias {
  const tema = leer(CLAVE_TEMA);
  const idioma = leer(CLAVE_IDIOMA);
  return {
    tema: esTemaPreferido(tema) ? tema : PREFERENCIAS_POR_DEFECTO.tema,
    idioma: esIdioma(idioma) ? idioma : PREFERENCIAS_POR_DEFECTO.idioma,
    reducirMovimiento: leerBooleano(CLAVE_REDUCIR_MOVIMIENTO, PREFERENCIAS_POR_DEFECTO.reducirMovimiento),
    textoGrande: leerBooleano(CLAVE_TEXTO_GRANDE, PREFERENCIAS_POR_DEFECTO.textoGrande),
    mostrarArranque: leerBooleano(CLAVE_MOSTRAR_ARRANQUE, PREFERENCIAS_POR_DEFECTO.mostrarArranque),
    sonido: leerBooleano(CLAVE_SONIDO, PREFERENCIAS_POR_DEFECTO.sonido),
    volumen: leerVolumen(),
  };
}

export function guardarPreferencias(p: Preferencias): void {
  escribir(CLAVE_TEMA, p.tema);
  escribir(CLAVE_IDIOMA, p.idioma);
  escribir(CLAVE_REDUCIR_MOVIMIENTO, String(p.reducirMovimiento));
  escribir(CLAVE_TEXTO_GRANDE, String(p.textoGrande));
  escribir(CLAVE_MOSTRAR_ARRANQUE, String(p.mostrarArranque));
  escribir(CLAVE_SONIDO, String(p.sonido));
  escribir(CLAVE_VOLUMEN, String(normalizarVolumen(p.volumen)));
}

/** Pinta en `<html>` lo que no es idioma: tema, `data-reduced-motion` y `data-text-large`. */
export function aplicarPreferencias(p: Preferencias, sistemaOscuro: boolean): void {
  aplicarTema(resolverTema(p.tema, sistemaOscuro));
  const { dataset } = document.documentElement;
  if (p.reducirMovimiento) dataset['reducedMotion'] = 'true';
  else delete dataset['reducedMotion'];
  if (p.textoGrande) dataset['textLarge'] = 'true';
  else delete dataset['textLarge'];
}
