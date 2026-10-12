import { PATRONES, VOLUMEN_POR_DEFECTO, gananciaMaestra, type NotaSonido, type Sonido } from '../domain/sonidos';

export interface ReproductorSonidos {
  /** Crea o reanuda el `AudioContext`. Solo sirve dentro de un gesto del usuario (clic o tecla). */
  activar(): void;
  configurar(ajustes: { readonly volumen: number; readonly silenciado: boolean }): void;
  reproducir(sonido: Sonido): void;
}

/** Subida de cada nota, para que no chasquee al empezar; la bajada ocupa el resto de la nota. */
const ATAQUE_S = 0.005;
const GANANCIA_MINIMA = 0.0001;

function programar(ctx: AudioContext, nota: NotaSonido, desde: number, maestra: number): void {
  const inicio = desde + nota.inicio;
  const fin = inicio + nota.duracion;
  const oscilador = ctx.createOscillator();
  const envolvente = ctx.createGain();
  oscilador.type = nota.onda;
  oscilador.frequency.setValueAtTime(nota.frecuencia, inicio);
  if (nota.hasta !== undefined) oscilador.frequency.linearRampToValueAtTime(nota.hasta, fin);
  envolvente.gain.setValueAtTime(GANANCIA_MINIMA, inicio);
  envolvente.gain.linearRampToValueAtTime(nota.ganancia * maestra, inicio + Math.min(ATAQUE_S, nota.duracion / 2));
  envolvente.gain.exponentialRampToValueAtTime(GANANCIA_MINIMA, fin);
  oscilador.connect(envolvente);
  envolvente.connect(ctx.destination);
  oscilador.start(inicio);
  oscilador.stop(fin);
}

/**
 * Sonidos sintetizados con Web Audio (sin archivos). El contexto no existe hasta `activar()`, que la consola
 * llama en el primer gesto del operador: antes de eso, o en silencio, `reproducir` no hace nada. Ningún fallo
 * de audio (navegador sin Web Audio, contexto bloqueado o cerrado) sale de aquí: la consola sigue sin sonido.
 */
export function crearReproductor(crearContexto: () => AudioContext = () => new AudioContext()): ReproductorSonidos {
  let ctx: AudioContext | null = null;
  let maestra = gananciaMaestra(VOLUMEN_POR_DEFECTO, false);

  return {
    activar() {
      try {
        ctx ??= crearContexto();
        if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
      } catch {
        ctx = null;
      }
    },
    configurar({ volumen, silenciado }) {
      maestra = gananciaMaestra(volumen, silenciado);
    },
    reproducir(sonido) {
      if (!ctx || maestra === 0 || ctx.state === 'closed') return;
      try {
        const desde = ctx.currentTime;
        for (const nota of PATRONES[sonido]) programar(ctx, nota, desde, maestra);
      } catch {
        /* sin sonido: la consola sigue */
      }
    },
  };
}

/** El de la consola: uno solo, compartido por la aplicación. */
export const reproductor: ReproductorSonidos = crearReproductor();
