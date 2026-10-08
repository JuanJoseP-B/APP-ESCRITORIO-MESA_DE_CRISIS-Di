import { describe, expect, it } from 'vitest';
import { ejecutarCarga } from './simulacion';

describe('carga de Realtime (perfil ligero, parte de npm run check)', () => {
  it('100 ciudadanos concurrentes reciben 40 alertas y convergen al mismo estado', () => {
    const r = ejecutarCarga({ clientes: 100, eventos: 40 });

    // 40 INSERT + 20 UPDATE por cliente
    expect(r.entregas).toBe(100 * 60);
    expect(r.estadosCoherentes).toBe(true);
    expect(r.filtraTimeline).toBe(false);
    expect(r.suscriptoresResiduales).toBe(0);
  });
});
