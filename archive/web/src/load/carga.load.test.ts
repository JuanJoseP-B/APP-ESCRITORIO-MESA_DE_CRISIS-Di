import { describe, expect, it } from 'vitest';
import { ejecutarCarga } from './simulacion';

// Perfil pesado: se ejecuta con `npm run test:load`, no con `npm run check`.
describe('carga de Realtime (perfil pesado)', () => {
  it('1000 ciudadanos concurrentes reciben 200 alertas sin pérdida ni fugas', () => {
    const r = ejecutarCarga({ clientes: 1000, eventos: 200 });
    console.info(
      `[carga] ${r.entregas} entregas en ${r.msTotal.toFixed(0)} ms (latencia máx. por evento ${r.latenciaMaxMs.toFixed(1)} ms)`,
    );

    expect(r.entregas).toBe(1000 * 300);
    expect(r.estadosCoherentes).toBe(true);
    expect(r.filtraTimeline).toBe(false);
    expect(r.suscriptoresResiduales).toBe(0);
    expect(r.latenciaMaxMs).toBeLessThan(1000);
  }, 60_000);
});
