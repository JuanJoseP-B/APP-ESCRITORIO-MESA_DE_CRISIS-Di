import { duracion } from '@argos/ui';

/**
 * Comprueba si el texto de un <kbd> coincide con la tecla pulsada.
 * Cubre teclas directas ("D", "A", "J", "K", "F1", "F2", "[", "]") y combinaciones / alias ("Esc" / "Escape", "Ctrl+Enter", "Enter", "?").
 */
export function coincideTeclaConKbd(nombreTecla: string, textoKbd: string): boolean {
  const a = nombreTecla.trim().toLowerCase();
  const b = textoKbd.trim().toLowerCase();
  if (a === b) return true;
  if ((a === 'escape' || a === 'esc') && (b === 'escape' || b === 'esc')) return true;
  if (a === '?' && (b === '?' || b === 'f1')) return true;
  if (a === 'ctrl+enter' && b === 'ctrl+enter') return true;
  return false;
}

/**
 * Hace destellar con `--dur-fast` todos los elementos `<kbd>` o `.ag-kbd` en el DOM
 * cuyo texto coincida con la tecla usada.
 */
export function destellarAtajo(nombreTecla: string, raiz: Document | Element = document): void {
  const elementos = raiz.querySelectorAll<HTMLElement>('kbd, .ag-kbd');
  const duracionMs = duracion('fast');
  for (const el of elementos) {
    if (coincideTeclaConKbd(nombreTecla, el.textContent ?? '')) {
      el.classList.remove('ag-kbd--destello');
      // Forzar reflow para reiniciar la animación CSS si se pulsa repetidas veces
      void el.offsetWidth;
      el.classList.add('ag-kbd--destello');
      el.dataset.destello = 'true';
      setTimeout(() => {
        el.classList.remove('ag-kbd--destello');
        delete el.dataset.destello;
      }, duracionMs > 0 ? duracionMs : 0);
    }
  }
}
