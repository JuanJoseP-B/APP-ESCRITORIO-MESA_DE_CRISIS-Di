import type { ClaveTexto } from '../i18n/es';

/** Lado del ancla donde se prefiere el popover; `centro` lo centra en el ancla (o en la pantalla si no hay). */
export type ColocacionPaso = 'arriba' | 'abajo' | 'izquierda' | 'derecha' | 'centro';

/** Condición de la consola que el paso necesita antes de mostrarse. */
export type RequisitoPaso = 'panelIzquierdo' | 'panelDerecho' | 'incidenteSeleccionado';

export interface TextosPaso {
  readonly titulo: ClaveTexto;
  readonly cuerpo: ClaveTexto;
  /** Indicación breve para pasos interactivos («Pulsa F2 para probar»). */
  readonly pista?: ClaveTexto;
}

export interface PasoTutorial {
  readonly id: string;
  /** Nombre del `data-tutorial` del elemento resaltado; `null` o ausente en pantalla: paso centrado, sin recorte. */
  readonly ancla: string | null;
  readonly clavesTexto: TextosPaso;
  readonly colocacion: ColocacionPaso;
  readonly requiere?: RequisitoPaso;
  /** Tecla que el operador puede probar; al detectarla el recorrido avanza solo. */
  readonly accionEsperada?: 'F2';
}

/** Recorrido completo de la consola, de la bienvenida al cierre. */
export const PASOS_TUTORIAL: readonly PasoTutorial[] = [
  {
    id: 'bienvenida',
    ancla: null,
    clavesTexto: { titulo: 'tutorial.paso.bienvenida.titulo', cuerpo: 'tutorial.paso.bienvenida.cuerpo' },
    colocacion: 'centro',
  },
  {
    id: 'barra',
    ancla: 'barra',
    clavesTexto: { titulo: 'tutorial.paso.barra.titulo', cuerpo: 'tutorial.paso.barra.cuerpo' },
    colocacion: 'abajo',
  },
  {
    id: 'entrantes',
    ancla: 'entrantes',
    clavesTexto: { titulo: 'tutorial.paso.entrantes.titulo', cuerpo: 'tutorial.paso.entrantes.cuerpo' },
    colocacion: 'derecha',
    requiere: 'panelIzquierdo',
  },
  {
    id: 'registro',
    ancla: 'formulario',
    clavesTexto: { titulo: 'tutorial.paso.registro.titulo', cuerpo: 'tutorial.paso.registro.cuerpo', pista: 'tutorial.paso.registro.pista' },
    colocacion: 'izquierda',
    requiere: 'panelDerecho',
    accionEsperada: 'F2',
  },
  {
    id: 'duplicados',
    ancla: 'formulario',
    clavesTexto: { titulo: 'tutorial.paso.duplicados.titulo', cuerpo: 'tutorial.paso.duplicados.cuerpo' },
    colocacion: 'izquierda',
    requiere: 'panelDerecho',
  },
  {
    id: 'cola',
    ancla: 'cola',
    clavesTexto: { titulo: 'tutorial.paso.cola.titulo', cuerpo: 'tutorial.paso.cola.cuerpo' },
    colocacion: 'derecha',
    requiere: 'panelIzquierdo',
  },
  {
    id: 'mapa',
    ancla: 'mapa',
    clavesTexto: { titulo: 'tutorial.paso.mapa.titulo', cuerpo: 'tutorial.paso.mapa.cuerpo' },
    colocacion: 'centro',
  },
  {
    id: 'detalle',
    ancla: 'detalle',
    clavesTexto: { titulo: 'tutorial.paso.detalle.titulo', cuerpo: 'tutorial.paso.detalle.cuerpo' },
    colocacion: 'izquierda',
    requiere: 'incidenteSeleccionado',
  },
  {
    id: 'tablero',
    ancla: 'tablero',
    clavesTexto: { titulo: 'tutorial.paso.tablero.titulo', cuerpo: 'tutorial.paso.tablero.cuerpo' },
    colocacion: 'arriba',
  },
  {
    id: 'asesor',
    ancla: 'asesor',
    clavesTexto: { titulo: 'tutorial.paso.asesor.titulo', cuerpo: 'tutorial.paso.asesor.cuerpo' },
    colocacion: 'izquierda',
    requiere: 'incidenteSeleccionado',
  },
  {
    id: 'cierre',
    ancla: 'ajustes',
    clavesTexto: { titulo: 'tutorial.paso.cierre.titulo', cuerpo: 'tutorial.paso.cierre.cuerpo' },
    colocacion: 'abajo',
  },
];

export interface EstadoTutorial {
  /** El recorrido está en pantalla. */
  readonly activo: boolean;
  readonly indice: number;
  /** Ya se vio o se descartó alguna vez: no se vuelve a invitar. */
  readonly visto: boolean;
}

export type AccionTutorial =
  | { readonly tipo: 'iniciar' }
  | { readonly tipo: 'siguiente' }
  | { readonly tipo: 'anterior' }
  /** Sale del recorrido a medias (Esc o «Saltar»). */
  | { readonly tipo: 'saltar' }
  | { readonly tipo: 'completar' }
  /** «Ahora no» en la invitación del primer arranque. */
  | { readonly tipo: 'descartarInvitacion' };

export const CLAVE_TUTORIAL_VISTO = 'argos.tutorialVisto';

/** Sin almacenamiento, o con basura, se cuenta como no visto: se invita de nuevo, sin romper nada. */
export function leerTutorialVisto(): boolean {
  try {
    return localStorage.getItem(CLAVE_TUTORIAL_VISTO) === 'true';
  } catch {
    return false;
  }
}

export function guardarTutorialVisto(): void {
  try {
    localStorage.setItem(CLAVE_TUTORIAL_VISTO, 'true');
  } catch {
    /* sin persistencia: la invitación no se repite durante esta sesión */
  }
}

export function estadoInicialTutorial(visto: boolean): EstadoTutorial {
  return { activo: false, indice: 0, visto };
}

export function reducirTutorial(estado: EstadoTutorial, accion: AccionTutorial, total: number = PASOS_TUTORIAL.length): EstadoTutorial {
  switch (accion.tipo) {
    case 'iniciar':
      return { ...estado, activo: true, indice: 0 };
    case 'siguiente':
      if (!estado.activo) return estado;
      return estado.indice >= total - 1 ? { activo: false, indice: 0, visto: true } : { ...estado, indice: estado.indice + 1 };
    case 'anterior':
      return estado.activo ? { ...estado, indice: Math.max(0, estado.indice - 1) } : estado;
    case 'saltar':
    case 'completar':
      return estado.activo ? { activo: false, indice: 0, visto: true } : estado;
    case 'descartarInvitacion':
      return estado.activo ? estado : { ...estado, visto: true };
  }
}
