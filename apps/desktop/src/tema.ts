export const TEMAS = ['crema', 'carbon'] as const;
export type Tema = (typeof TEMAS)[number];

const CLAVE = 'argos.tema';

function esTema(v: string | null): v is Tema {
  return v === 'crema' || v === 'carbon';
}

/** Lee el turno guardado (crema por defecto); el almacenamiento puede no estar disponible. */
export function temaGuardado(): Tema {
  try {
    const v = localStorage.getItem(CLAVE);
    return esTema(v) ? v : 'crema';
  } catch {
    return 'crema';
  }
}

export function aplicarTema(tema: Tema): void {
  document.documentElement.dataset.theme = tema;
  try {
    localStorage.setItem(CLAVE, tema);
  } catch {
    /* sin persistencia: el tema sigue aplicado en esta sesión */
  }
}
