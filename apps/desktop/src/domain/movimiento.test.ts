import { describe, expect, it } from 'vitest';
import type { EventoRecurso, Incidente, Recurso } from '@argos/shared';
import { distanciaM } from './geo';
import {
  PASOS_SIN_ANIMACION,
  VELOCIDAD_MS,
  duracionTrayectoSeg,
  estadoTrayecto,
  movimientosEnRuta,
  posicionesDe,
  type Trayecto,
} from './movimiento';

const SALIDA = Date.parse('2026-10-08T10:00:00Z');
const trayecto: Trayecto = { origen: { lat: 1.2136, lng: -77.2811 }, destino: { lat: 1.2181, lng: -77.2811 }, salidaMs: SALIDA };

describe('estadoTrayecto', () => {
  it('sale de la base y llega al incidente tras el tiempo que marca la velocidad del tipo', () => {
    const duracionMs = duracionTrayectoSeg('Ambulancia', trayecto) * 1000;
    expect(duracionMs).toBeCloseTo((distanciaM(trayecto.origen, trayecto.destino) / VELOCIDAD_MS.Ambulancia) * 1000, 6);
    const salida = estadoTrayecto('Ambulancia', trayecto, SALIDA);
    expect([salida.progreso, salida.posicion, salida.llego]).toEqual([0, trayecto.origen, false]);
    const llegada = estadoTrayecto('Ambulancia', trayecto, SALIDA + duracionMs);
    expect([llegada.progreso, llegada.llego, llegada.restanteM]).toEqual([1, true, 0]);
    expect(llegada.posicion).toEqual(trayecto.destino);
  });

  it('a mitad de tiempo está a mitad de camino y le falta la mitad de la distancia', () => {
    const mitad = SALIDA + (duracionTrayectoSeg('Bomberos', trayecto) * 1000) / 2;
    const e = estadoTrayecto('Bomberos', trayecto, mitad);
    expect(e.progreso).toBeCloseTo(0.5, 6);
    expect(e.posicion.lat).toBeCloseTo((1.2136 + 1.2181) / 2, 6);
    expect(e.restanteM).toBeCloseTo(distanciaM(trayecto.origen, trayecto.destino) / 2, 0);
  });

  it('cada tipo cubre el mismo trayecto a su propia velocidad', () => {
    const t = (tipo: Recurso['tipo']) => duracionTrayectoSeg(tipo, trayecto);
    expect(t('Policía')).toBeLessThan(t('Ambulancia'));
    expect(t('Ambulancia')).toBeLessThan(t('Bomberos'));
  });

  it('acota el progreso: antes de salir vale 0 y pasado el tiempo sigue en 1', () => {
    expect(estadoTrayecto('Policía', trayecto, SALIDA - 60_000).progreso).toBe(0);
    const tarde = estadoTrayecto('Policía', trayecto, SALIDA + 3_600_000);
    expect([tarde.progreso, tarde.llego]).toEqual([1, true]);
  });

  it('con pasos la unidad salta en vez de deslizarse, y llegar siempre cuenta', () => {
    const duracionMs = duracionTrayectoSeg('Ambulancia', trayecto) * 1000;
    const progresos = [0.1, 0.3, 0.49, 0.6, 0.99].map(
      (f) => estadoTrayecto('Ambulancia', trayecto, SALIDA + duracionMs * f, PASOS_SIN_ANIMACION).progreso,
    );
    expect(progresos).toEqual([0, 0.25, 0.25, 0.5, 0.75]);
    expect(estadoTrayecto('Ambulancia', trayecto, SALIDA + duracionMs, PASOS_SIN_ANIMACION).progreso).toBe(1);
  });

  it('un trayecto de longitud cero llega al instante', () => {
    const quieto: Trayecto = { origen: trayecto.origen, destino: trayecto.origen, salidaMs: SALIDA };
    expect(estadoTrayecto('Ambulancia', quieto, SALIDA).llego).toBe(true);
  });
});

const incidente = (id: string): Incidente => ({
  id,
  titulo: 'Fuga',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'FUGA_GAS',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [trayecto.destino.lng, trayecto.destino.lat] },
  timeline: [],
});

const recurso = (id: string, estado: Recurso['estado_actual'], extra: Partial<Recurso> = {}): Recurso => ({
  id,
  tipo: 'Ambulancia',
  estado_actual: estado,
  incidente_asignado_id: 'i1',
  base: trayecto.origen,
  ubicacion: trayecto.origen,
  ...extra,
});

const evento = (n: number, recursoId: string, hacia: EventoRecurso['hacia'], creadoEn: string): EventoRecurso => ({
  id: `e${n}`,
  recursoId,
  incidenteId: 'i1',
  desde: 'ASIGNADO',
  hacia,
  origen: 'MANUAL',
  creadoEn,
});

describe('movimientosEnRuta', () => {
  const salidaIso = new Date(SALIDA).toISOString();
  const ahora = SALIDA + (duracionTrayectoSeg('Ambulancia', trayecto) * 1000) / 2;

  it('solo mueve las unidades EN_RUTA con incidente, base y salida registrada', () => {
    const recursos = [
      recurso('r1', 'EN_RUTA'),
      recurso('r2', 'ASIGNADO'),
      recurso('r3', 'EN_RUTA', { incidente_asignado_id: null }),
      recurso('r4', 'EN_RUTA', { base: null, ubicacion: null }),
      recurso('r5', 'EN_RUTA'),
    ];
    const eventos = [evento(1, 'r1', 'EN_RUTA', salidaIso), evento(2, 'r2', 'ASIGNADO', salidaIso), evento(3, 'r3', 'EN_RUTA', salidaIso), evento(4, 'r4', 'EN_RUTA', salidaIso)];
    const m = movimientosEnRuta(recursos, eventos, [incidente('i1')], ahora);
    expect(m.map((x) => x.recursoId)).toEqual(['r1']);
    expect(m[0]?.progreso).toBeCloseTo(0.5, 6);
    expect(m[0]?.destino).toEqual(trayecto.destino);
  });

  it('toma la última salida cuando la unidad fue despachada más de una vez', () => {
    const antes = new Date(SALIDA - 600_000).toISOString();
    const m = movimientosEnRuta([recurso('r1', 'EN_RUTA')], [evento(1, 'r1', 'EN_RUTA', antes), evento(2, 'r1', 'EN_RUTA', salidaIso)], [incidente('i1')], SALIDA);
    expect(m[0]?.progreso).toBe(0);
  });

  it('ignora una unidad cuyo incidente ya no existe', () => {
    expect(movimientosEnRuta([recurso('r1', 'EN_RUTA')], [evento(1, 'r1', 'EN_RUTA', salidaIso)], [], ahora)).toEqual([]);
  });

  it('posicionesDe indexa la posición mostrada por recurso', () => {
    const m = movimientosEnRuta([recurso('r1', 'EN_RUTA')], [evento(1, 'r1', 'EN_RUTA', salidaIso)], [incidente('i1')], ahora);
    expect(posicionesDe(m).get('r1')).toEqual(m[0]?.posicion);
  });
});
