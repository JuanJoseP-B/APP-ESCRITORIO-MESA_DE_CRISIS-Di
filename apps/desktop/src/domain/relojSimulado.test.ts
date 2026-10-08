import { describe, expect, it } from 'vitest';
import { crearRelojSimulado } from './relojSimulado';

/** Reloj real controlable: `avanzar` suma milisegundos. */
function relojReal(inicio = 1_000_000) {
  let t = inicio;
  return { ahora: () => t, avanzar: (ms: number) => void (t += ms) };
}

describe('crearRelojSimulado', () => {
  it('arranca en marcha a 1× con la hora del equipo', () => {
    const real = relojReal();
    const reloj = crearRelojSimulado(real.ahora);
    expect(reloj).toMatchObject({ velocidad: 1, reproduciendo: true });
    expect(reloj.ahora()).toBe(1_000_000);
    expect(reloj.transcurridoSeg()).toBe(0);
    real.avanzar(3_000);
    expect(reloj.ahora()).toBe(1_003_000);
    expect(reloj.transcurridoSeg()).toBe(3);
  });

  it('acelera el tiempo según la velocidad', () => {
    const real = relojReal();
    const reloj = crearRelojSimulado(real.ahora);
    reloj.fijarVelocidad(10);
    real.avanzar(2_000);
    expect(reloj.transcurridoSeg()).toBe(20);
    expect(reloj.ahora()).toBe(1_020_000);
  });

  it('cambiar de velocidad no salta en el tiempo ya transcurrido', () => {
    const real = relojReal();
    const reloj = crearRelojSimulado(real.ahora);
    real.avanzar(4_000);
    reloj.fijarVelocidad(5);
    expect(reloj.transcurridoSeg()).toBe(4);
    real.avanzar(2_000);
    reloj.fijarVelocidad(1);
    expect(reloj.transcurridoSeg()).toBe(14);
    real.avanzar(1_000);
    expect(reloj.transcurridoSeg()).toBe(15);
  });

  it('en pausa el tiempo se congela y al reanudar continúa desde ahí', () => {
    const real = relojReal();
    const reloj = crearRelojSimulado(real.ahora);
    real.avanzar(5_000);
    reloj.pausar();
    expect(reloj.reproduciendo).toBe(false);
    real.avanzar(60_000);
    expect(reloj.transcurridoSeg()).toBe(5);
    reloj.reproducir();
    real.avanzar(1_000);
    expect(reloj.transcurridoSeg()).toBe(6);
  });

  it('pausar o reproducir dos veces seguidas no altera el tiempo', () => {
    const real = relojReal();
    const reloj = crearRelojSimulado(real.ahora);
    reloj.reproducir();
    real.avanzar(1_000);
    reloj.pausar();
    real.avanzar(1_000);
    reloj.pausar();
    expect(reloj.transcurridoSeg()).toBe(1);
  });

  it('cambiar la velocidad en pausa se aplica al reanudar', () => {
    const real = relojReal();
    const reloj = crearRelojSimulado(real.ahora);
    reloj.pausar();
    reloj.fijarVelocidad(5);
    expect(reloj.velocidad).toBe(5);
    real.avanzar(10_000);
    expect(reloj.transcurridoSeg()).toBe(0);
    reloj.reproducir();
    real.avanzar(2_000);
    expect(reloj.transcurridoSeg()).toBe(10);
  });
});
