import type { RealtimePostgresChangesPayload, SupabaseClient } from '@supabase/supabase-js';
import type { ZonaRiesgo } from '@argos/shared';
import { aplicarCambio } from '../domain/realtime';
import { crearServicioPortal } from '../services/supabaseClient';

type Fila = Record<string, unknown>;
type Manejador = (payload: RealtimePostgresChangesPayload<Fila>) => void;

/** Hub que imita el motor Realtime: difunde cada cambio a todos los canales suscritos a la tabla. */
export class HubRealtime {
  private readonly manejadores = new Map<string, Set<Manejador>>();

  get suscriptores(): number {
    let total = 0;
    for (const m of this.manejadores.values()) total += m.size;
    return total;
  }

  registrar(tabla: string, manejador: Manejador): () => void {
    const set = this.manejadores.get(tabla) ?? new Set<Manejador>();
    set.add(manejador);
    this.manejadores.set(tabla, set);
    return () => void set.delete(manejador);
  }

  emitir(tabla: string, payload: RealtimePostgresChangesPayload<Fila>): void {
    this.manejadores.get(tabla)?.forEach((m) => m(payload));
  }
}

/** Cliente Supabase mínimo cuyo `channel().on().subscribe()` se conecta al hub. */
function clienteFalso(hub: HubRealtime): SupabaseClient {
  const darDeBaja = new Map<object, () => void>();
  const client = {
    channel: () => {
      let baja: (() => void) | null = null;
      const canal = {
        on: (_evento: string, filtro: { table: string }, manejador: Manejador) => {
          baja = hub.registrar(filtro.table, manejador);
          return canal;
        },
        subscribe: () => {
          if (baja) darDeBaja.set(canal, baja);
          return canal;
        },
      };
      return canal;
    },
    removeChannel: (canal: object) => {
      darDeBaja.get(canal)?.();
      darDeBaja.delete(canal);
      return Promise.resolve('ok');
    },
  };
  return client as unknown as SupabaseClient;
}

export interface ResultadoCarga {
  readonly clientes: number;
  readonly eventos: number;
  readonly entregas: number;
  readonly msTotal: number;
  readonly latenciaMaxMs: number;
  readonly estadosCoherentes: boolean;
  readonly filtraTimeline: boolean;
  readonly suscriptoresResiduales: number;
}

const zonaCompleta = (i: number): Fila => ({
  id: `zona-${i}`,
  titulo: `Zona ${i}`,
  nivel_criticidad: 'Crítico',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [i, i] },
  // Dato interno: Realtime lo entregaría; el servicio del portal debe descartarlo.
  timeline: [{ timestamp: '2026-10-02T08:00:00Z', descripcion: 'interno' }],
});

const payload = (
  eventType: 'INSERT' | 'UPDATE' | 'DELETE',
  nuevo: Fila,
): RealtimePostgresChangesPayload<Fila> =>
  ({ eventType, new: eventType === 'DELETE' ? {} : nuevo, old: eventType === 'DELETE' ? { id: nuevo['id'] } : {} }) as
    unknown as RealtimePostgresChangesPayload<Fila>;

/**
 * `clientes` ciudadanos conectados reciben `eventos` zonas de riesgo (INSERT) y luego se
 * resuelve cada zona par (UPDATE a Resuelto => desaparece). Verifica que todos convergen
 * al mismo estado, que no se filtra `timeline` y que cancelar libera las suscripciones.
 */
export function ejecutarCarga({ clientes, eventos }: { clientes: number; eventos: number }): ResultadoCarga {
  const hub = new HubRealtime();
  const estados: (readonly ZonaRiesgo[])[] = [];
  const cancelaciones: (() => void)[] = [];
  let entregas = 0;
  let filtraTimeline = false;
  let latenciaMaxMs = 0;
  let inicioEmision = 0;

  for (let c = 0; c < clientes; c++) {
    const servicio = crearServicioPortal(clienteFalso(hub));
    estados.push([]);
    cancelaciones.push(
      servicio.suscribirZonasRiesgo((cambio) => {
        entregas++;
        latenciaMaxMs = Math.max(latenciaMaxMs, performance.now() - inicioEmision);
        if (cambio.nuevo && 'timeline' in cambio.nuevo) filtraTimeline = true;
        estados[c] = aplicarCambio(estados[c] ?? [], cambio);
      }),
    );
  }

  const inicio = performance.now();
  for (let i = 0; i < eventos; i++) {
    inicioEmision = performance.now();
    hub.emitir('zonas_riesgo', payload('INSERT', zonaCompleta(i)));
  }
  for (let i = 0; i < eventos; i += 2) {
    inicioEmision = performance.now();
    hub.emitir('zonas_riesgo', payload('UPDATE', { ...zonaCompleta(i), estado: 'Resuelto' }));
  }
  const msTotal = performance.now() - inicio;

  const esperadas = Math.floor(eventos / 2);
  const estadosCoherentes = estados.every(
    (e) => e.length === esperadas && e.every((z) => Number(z.id.split('-')[1]) % 2 === 1),
  );

  cancelaciones.forEach((c) => c());
  return {
    clientes,
    eventos,
    entregas,
    msTotal,
    latenciaMaxMs,
    estadosCoherentes,
    filtraTimeline,
    suscriptoresResiduales: hub.suscriptores,
  };
}
