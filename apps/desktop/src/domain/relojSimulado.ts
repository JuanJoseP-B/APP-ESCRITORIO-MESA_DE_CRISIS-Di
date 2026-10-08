export const VELOCIDADES = [1, 5, 10] as const;
export type Velocidad = (typeof VELOCIDADES)[number];

/** Reloj del demo: puede pausarse y correr a 1×, 5× o 10×. Al crearse marca la hora del equipo y empieza en marcha. */
export interface RelojSimulado {
  /** Hora simulada (ms epoch); es la que usan la consola y el servicio demo. */
  readonly ahora: () => number;
  /** Segundos simulados desde el inicio del escenario; no avanza en pausa. */
  readonly transcurridoSeg: () => number;
  readonly velocidad: Velocidad;
  readonly reproduciendo: boolean;
  reproducir(): void;
  pausar(): void;
  fijarVelocidad(velocidad: Velocidad): void;
}

/** `ahoraReal` se inyecta en las pruebas. */
export function crearRelojSimulado(ahoraReal: () => number = Date.now): RelojSimulado {
  const inicio = ahoraReal();
  let anclaReal = inicio;
  let anclaSim = inicio;
  let velocidad: Velocidad = 1;
  let reproduciendo = true;

  const ahora = (): number => (reproduciendo ? anclaSim + (ahoraReal() - anclaReal) * velocidad : anclaSim);
  /** Fija la hora simulada actual antes de cambiar de marcha, para que el cambio no salte en el tiempo. */
  const reanclar = (): void => {
    anclaSim = ahora();
    anclaReal = ahoraReal();
  };

  return {
    ahora,
    transcurridoSeg: () => (ahora() - inicio) / 1000,
    get velocidad() {
      return velocidad;
    },
    get reproduciendo() {
      return reproduciendo;
    },
    reproducir() {
      if (reproduciendo) return;
      anclaReal = ahoraReal();
      reproduciendo = true;
    },
    pausar() {
      if (!reproduciendo) return;
      reanclar();
      reproduciendo = false;
    },
    fijarVelocidad(nueva) {
      reanclar();
      velocidad = nueva;
    },
  };
}
