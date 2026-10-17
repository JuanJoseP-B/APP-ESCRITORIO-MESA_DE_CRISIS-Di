import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from './Button';
import './Coachmark.css';

export type ColocacionCoachmark = 'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'centro';

export interface RectCoachmark {
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface PosicionCoachmark {
  readonly top: number;
  readonly left: number;
}

const MARGEN = 12;
const SEPARACION = 12;
/** Holgura del recorte alrededor del ancla. */
const HOLGURA = 4;
const REMEDIR_MS = 250;

const OPUESTO = { arriba: 'abajo', abajo: 'arriba', izquierda: 'derecha', derecha: 'izquierda' } as const;
const LADOS = ['arriba', 'abajo', 'izquierda', 'derecha'] as const;
type Lado = (typeof LADOS)[number];

const acotar = (valor: number, minimo: number, maximo: number): number => Math.max(minimo, Math.min(valor, maximo));

/**
 * Esquina superior izquierda del popover. Prueba primero el lado pedido, luego el opuesto y después los demás; el
 * lado elegido es el primero donde cabe y el otro eje se acota a la pantalla. Sin ancla, con `centro` o si no cabe
 * en ningún lado (ancla enorme), queda centrado en el ancla —o en la pantalla— y acotado a la pantalla.
 */
export function posicionarPopover(
  ancla: RectCoachmark | null,
  popover: { readonly ancho: number; readonly alto: number },
  pantalla: { readonly ancho: number; readonly alto: number },
  colocacion: ColocacionCoachmark,
): PosicionCoachmark {
  const { ancho, alto } = popover;
  const acotarPantalla = (top: number, left: number): PosicionCoachmark => ({
    top: acotar(top, MARGEN, Math.max(MARGEN, pantalla.alto - alto - MARGEN)),
    left: acotar(left, MARGEN, Math.max(MARGEN, pantalla.ancho - ancho - MARGEN)),
  });
  const caja = ancla ?? { top: 0, left: 0, width: pantalla.ancho, height: pantalla.alto };
  const centrado = acotarPantalla(caja.top + caja.height / 2 - alto / 2, caja.left + caja.width / 2 - ancho / 2);
  if (!ancla || colocacion === 'centro') return centrado;

  const centroX = ancla.left + ancla.width / 2 - ancho / 2;
  const centroY = ancla.top + ancla.height / 2 - alto / 2;
  const intentos: Readonly<Record<Lado, { readonly cabe: boolean; readonly pos: PosicionCoachmark }>> = {
    arriba: { cabe: ancla.top - SEPARACION - alto >= MARGEN, pos: acotarPantalla(ancla.top - SEPARACION - alto, centroX) },
    abajo: {
      cabe: ancla.top + ancla.height + SEPARACION + alto <= pantalla.alto - MARGEN,
      pos: acotarPantalla(ancla.top + ancla.height + SEPARACION, centroX),
    },
    izquierda: { cabe: ancla.left - SEPARACION - ancho >= MARGEN, pos: acotarPantalla(centroY, ancla.left - SEPARACION - ancho) },
    derecha: {
      cabe: ancla.left + ancla.width + SEPARACION + ancho <= pantalla.ancho - MARGEN,
      pos: acotarPantalla(centroY, ancla.left + ancla.width + SEPARACION),
    },
  };
  const orden: readonly Lado[] = [colocacion, OPUESTO[colocacion], ...LADOS.filter((l) => l !== colocacion && l !== OPUESTO[colocacion])];
  for (const lado of orden) {
    const intento = intentos[lado];
    if (intento.cabe) return intento.pos;
  }
  return centrado;
}

/** Caja del ancla en pantalla, o `null` si no hay ancla, ya no está en el documento o no se ve (tamaño cero). */
function medirAncla(ancla: HTMLElement | null): RectCoachmark | null {
  if (!ancla?.isConnected) return null;
  const r = ancla.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

const mismaCaja = (a: RectCoachmark | null, b: RectCoachmark | null): boolean =>
  a === b || (a !== null && b !== null && a.top === b.top && a.left === b.left && a.width === b.width && a.height === b.height);

const FOCALIZABLES = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function esCampo(destino: EventTarget | null): boolean {
  if (!(destino instanceof HTMLElement)) return false;
  return destino.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino.tagName);
}

export interface EtiquetasCoachmark {
  /** Nombre accesible del diálogo, p. ej. «Tutorial guiado». */
  readonly dialogo: string;
  /** Lectura del progreso para lectores de pantalla, p. ej. «Paso 3 de 11». */
  readonly progreso: string;
  readonly anterior: string;
  readonly siguiente: string;
  /** Sustituye a «Siguiente» en el último paso. */
  readonly finalizar: string;
  readonly saltar: string;
  /** Recordatorio de teclas, p. ej. «← → para navegar · Esc para salir». */
  readonly teclas: string;
}

export interface CoachmarkProps {
  /** Elemento que se resalta; `null` (o fuera de pantalla) muestra el paso centrado y sin recorte. */
  ancla: HTMLElement | null;
  titulo: string;
  texto: string;
  /** Indicación de un paso interactivo, junto al texto. */
  pista?: string;
  /** Paso actual, desde 0. */
  indice: number;
  total: number;
  colocacion?: ColocacionCoachmark;
  etiquetas: EtiquetasCoachmark;
  /** Tecla que el paso espera probar: llega a la consola en vez de quedar bloqueada, p. ej. «F2». */
  teclaLibre?: string;
  /** Sin transiciones; también las apaga el tema cuando el sistema o Ajustes lo piden. */
  reducirMovimiento?: boolean;
  onAnterior: () => void;
  onSiguiente: () => void;
  onSaltar: () => void;
}

/**
 * Paso de un recorrido guiado: oscurece la pantalla salvo el ancla (foco de luz) y muestra un popover con el
 * progreso y los botones. El teclado queda en el popover: ← → navegan, Esc sale y Tab da la vuelta sin salir; el
 * resto de atajos de la consola se apagan, salvo `teclaLibre`. Se recoloca al redimensionar y si el ancla se mueve.
 */
export function Coachmark({
  ancla,
  titulo,
  texto,
  pista,
  indice,
  total,
  colocacion = 'abajo',
  etiquetas,
  teclaLibre,
  reducirMovimiento = false,
  onAnterior,
  onSiguiente,
  onSaltar,
}: CoachmarkProps) {
  const popover = useRef<HTMLDivElement>(null);
  const [caja, setCaja] = useState<RectCoachmark | null>(null);
  const [pantalla, setPantalla] = useState(() => ({ ancho: window.innerWidth, alto: window.innerHeight }));
  const [posicion, setPosicion] = useState<PosicionCoachmark | null>(null);
  const esPrimero = indice === 0;
  const esUltimo = indice >= total - 1;

  const medir = useCallback(() => {
    const nueva = medirAncla(ancla);
    setCaja((actual) => (mismaCaja(actual, nueva) ? actual : nueva));
    setPantalla((actual) => (actual.ancho === window.innerWidth && actual.alto === window.innerHeight ? actual : { ancho: window.innerWidth, alto: window.innerHeight }));
  }, [ancla]);

  useLayoutEffect(medir, [medir, indice]);
  useEffect(() => {
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    const observador = typeof ResizeObserver === 'undefined' || !ancla ? null : new ResizeObserver(medir);
    if (ancla) observador?.observe(ancla);
    // Un panel que se despliega mueve el ancla sin cambiar su tamaño ni disparar `resize`.
    const id = setInterval(medir, REMEDIR_MS);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
      observador?.disconnect();
      clearInterval(id);
    };
  }, [medir, ancla]);

  useLayoutEffect(() => {
    const el = popover.current;
    if (!el) return;
    const nueva = posicionarPopover(caja, { ancho: el.offsetWidth, alto: el.offsetHeight }, pantalla, colocacion);
    setPosicion((actual) => (actual && actual.top === nueva.top && actual.left === nueva.left ? actual : nueva));
  }, [caja, pantalla, colocacion, titulo, texto, pista]);

  // Cada paso lleva el foco al botón principal, también cuando la consola se lo había llevado a otro sitio.
  useEffect(() => {
    popover.current?.querySelector<HTMLElement>('[data-foco-inicial]')?.focus();
  }, [indice]);

  // Los callbacks cambian en cada render del padre: el listener se registra una sola vez y los lee de una ref.
  const vivo = useRef({ onAnterior, onSiguiente, onSaltar, teclaLibre, esPrimero });
  vivo.current = { onAnterior, onSiguiente, onSaltar, teclaLibre, esPrimero };
  useEffect(() => {
    const alPulsar = (e: KeyboardEvent) => {
      const { onAnterior: atras, onSiguiente: adelante, onSaltar: salir, teclaLibre: libre, esPrimero: primero } = vivo.current;
      if (libre !== undefined && e.key === libre) return;
      const panel = popover.current;
      const dentro = panel !== null && e.target instanceof Node && panel.contains(e.target);
      // Escribir en un campo de la consola (el formulario abierto por el paso interactivo) no se toca.
      const enCampoAjeno = esCampo(e.target) && !dentro;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        salir();
      } else if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !enCampoAjeno) {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'ArrowRight') adelante();
        else if (!primero) atras();
      } else if (e.key === 'Tab' && panel) {
        e.stopPropagation();
        const enfocables = [...panel.querySelectorAll<HTMLElement>(FOCALIZABLES)];
        const primerBoton = enfocables[0];
        const ultimoBoton = enfocables[enfocables.length - 1];
        if (!primerBoton || !ultimoBoton) return;
        if (!dentro) {
          e.preventDefault();
          primerBoton.focus();
        } else if (e.shiftKey && document.activeElement === primerBoton) {
          e.preventDefault();
          ultimoBoton.focus();
        } else if (!e.shiftKey && document.activeElement === ultimoBoton) {
          e.preventDefault();
          primerBoton.focus();
        }
      } else if (!enCampoAjeno) {
        // Los atajos de la consola (J, K, D, A, F1…) quedan en pausa mientras dura el recorrido.
        e.stopPropagation();
      }
    };
    document.addEventListener('keydown', alPulsar, true);
    return () => document.removeEventListener('keydown', alPulsar, true);
  }, []);

  const recorte = caja
    ? {
        top: Math.max(0, caja.top - HOLGURA),
        left: Math.max(0, caja.left - HOLGURA),
        width: caja.width + HOLGURA * 2,
        height: caja.height + HOLGURA * 2,
      }
    : null;

  return (
    <div className="ag-coach" data-movimiento={reducirMovimiento ? 'reducido' : 'normal'} data-recorte={recorte ? 'true' : 'false'}>
      {recorte ? (
        <>
          {/* Cuatro paños alrededor del recorte: oscurecen y bloquean el puntero salvo sobre el ancla. */}
          <div aria-hidden="true" className="ag-coach__pano" style={{ top: 0, left: 0, right: 0, height: recorte.top }} />
          <div aria-hidden="true" className="ag-coach__pano" style={{ top: recorte.top, left: 0, width: recorte.left, height: recorte.height }} />
          <div aria-hidden="true" className="ag-coach__pano" style={{ top: recorte.top, left: recorte.left + recorte.width, right: 0, height: recorte.height }} />
          <div aria-hidden="true" className="ag-coach__pano" style={{ top: recorte.top + recorte.height, left: 0, right: 0, bottom: 0 }} />
          <div aria-hidden="true" className="ag-coach__anillo" style={recorte} />
        </>
      ) : (
        <div aria-hidden="true" className="ag-coach__pano" style={{ inset: 0 }} />
      )}
      <div
        ref={popover}
        role="dialog"
        aria-modal="true"
        aria-label={etiquetas.dialogo}
        className="ag-coach__popover"
        style={posicion ?? undefined}
      >
        <div className="ag-coach__cabecera">
          <span className="ag-coach__progreso" aria-label={etiquetas.progreso}>
            {indice + 1}/{total}
          </span>
          <span className="ag-coach__teclas">{etiquetas.teclas}</span>
        </div>
        <div aria-live="polite" aria-atomic="true" className="ag-coach__texto">
          <h2 className="ag-coach__titulo">
            {titulo}
          </h2>
          <p className="ag-coach__cuerpo">{texto}</p>
          {pista ? <p className="ag-coach__pista">{pista}</p> : null}
        </div>
        <div className="ag-coach__acciones">
          <Button size="sm" variant="ghost" onClick={onSaltar}>
            {etiquetas.saltar}
          </Button>
          <span className="ag-coach__espacio" />
          <Button size="sm" variant="secondary" disabled={esPrimero} onClick={onAnterior}>
            {etiquetas.anterior}
          </Button>
          <Button data-foco-inicial size="sm" variant="primary" onClick={onSiguiente}>
            {esUltimo ? etiquetas.finalizar : etiquetas.siguiente}
          </Button>
        </div>
      </div>
    </div>
  );
}
