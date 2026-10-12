import { describe, expect, it, vi } from 'vitest';
import { PATRONES } from '../domain/sonidos';
import { crearReproductor } from './reproductorSonidos';

const parametro = () => ({ setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });

/** Lo mínimo de Web Audio que usa el reproductor, con espías. */
function contextoFalso(estado: AudioContextState = 'running') {
  const osciladores: { type: string; frequency: ReturnType<typeof parametro>; start: ReturnType<typeof vi.fn> }[] = [];
  const ganancias: { gain: ReturnType<typeof parametro> }[] = [];
  const ctx = {
    state: estado,
    currentTime: 10,
    destination: {},
    resume: vi.fn(() => Promise.resolve()),
    createOscillator: vi.fn(() => {
      const o = { type: 'sine', frequency: parametro(), connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      osciladores.push(o);
      return o;
    }),
    createGain: vi.fn(() => {
      const g = { gain: parametro(), connect: vi.fn() };
      ganancias.push(g);
      return g;
    }),
  };
  return { ctx, osciladores, ganancias, fabrica: vi.fn(() => ctx as unknown as AudioContext) };
}

describe('reproductor de sonidos', () => {
  it('no crea el contexto ni suena hasta el primer gesto', () => {
    const { fabrica, osciladores } = contextoFalso();
    const r = crearReproductor(fabrica);
    r.reproducir('llamadaP1');
    expect(fabrica).not.toHaveBeenCalled();
    r.activar();
    r.activar();
    expect(fabrica).toHaveBeenCalledTimes(1);
    r.reproducir('llamadaP1');
    expect(osciladores).toHaveLength(PATRONES.llamadaP1.length);
  });

  it('programa cada nota a partir de la hora del contexto, con su onda y su deslizamiento', () => {
    const { fabrica, osciladores } = contextoFalso();
    const r = crearReproductor(fabrica);
    r.activar();
    r.reproducir('llamadaP1');
    expect(osciladores.map((o) => o.type)).toEqual(['square', 'square']);
    expect(osciladores[1]?.start).toHaveBeenCalledWith(10.16);
    r.reproducir('slaVencido');
    expect(osciladores[2]?.frequency.linearRampToValueAtTime).toHaveBeenCalledWith(330, 10.35);
  });

  it('un contexto suspendido se reanuda al activar', () => {
    const { fabrica, ctx } = contextoFalso('suspended');
    crearReproductor(fabrica).activar();
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it('en silencio no suena; el volumen escala la ganancia de la nota', () => {
    const { fabrica, osciladores, ganancias } = contextoFalso();
    const r = crearReproductor(fabrica);
    r.activar();
    r.configurar({ volumen: 80, silenciado: true });
    r.reproducir('despacho');
    expect(osciladores).toHaveLength(0);
    r.configurar({ volumen: 50, silenciado: false });
    r.reproducir('arranque');
    const pico: unknown = ganancias[0]?.gain.linearRampToValueAtTime.mock.calls[0]?.[0];
    expect(pico).toBeCloseTo((PATRONES.arranque[0]?.ganancia ?? 0) * 0.5);
  });

  it('un navegador sin Web Audio o un fallo al sonar nunca lanza', () => {
    const sinAudio = crearReproductor(() => {
      throw new Error('sin Web Audio');
    });
    expect(() => {
      sinAudio.activar();
      sinAudio.reproducir('resuelto');
    }).not.toThrow();

    const { fabrica, ctx } = contextoFalso();
    ctx.createOscillator.mockImplementation(() => {
      throw new Error('contexto roto');
    });
    const roto = crearReproductor(fabrica);
    roto.activar();
    expect(() => roto.reproducir('resuelto')).not.toThrow();
  });
});
