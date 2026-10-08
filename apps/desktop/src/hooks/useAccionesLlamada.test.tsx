// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { CandidatoDuplicado, NuevaLlamada } from '@argos/shared';
import { crearServicioDemo } from '../services/servicioDemo';
import type { ServicioMesa } from '../services/supabaseClient';
import { useAccionesLlamada } from './useAccionesLlamada';

const AHORA = Date.parse('2026-10-08T12:00:00Z');

const DATOS: NuevaLlamada = {
  canal: '123',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: { lat: 1.2231, lng: -77.2862 },
  narrativa: 'Olor fuerte a gas.',
  reportante: 'Residente',
  callback: null,
};

async function montar(extra: Partial<ServicioMesa> = {}) {
  const servicio: ServicioMesa = { ...crearServicioDemo({ ahora: () => AHORA }), ...extra };
  const incidentes = await servicio.listarIncidentes();
  const alAvisar = vi.fn();
  const alSeleccionar = vi.fn();
  const { result } = renderHook(() =>
    useAccionesLlamada({ servicio, incidentes, alSeleccionar, alAvisar, operador: 'op@argos.test', ahora: () => AHORA }),
  );
  return { servicio, alAvisar, alSeleccionar, acciones: result };
}

describe('useAccionesLlamada · crearIncidente', () => {
  it('con una llamada entrante crea el incidente, la vincula y lo selecciona', async () => {
    const { servicio, acciones, alSeleccionar, alAvisar } = await montar();
    const entrante = await servicio.registrarLlamada(DATOS);

    await expect(acciones.current.crearIncidente(DATOS, entrante.id)).resolves.toBe(true);

    const incidentes = await servicio.listarIncidentes();
    const creado = incidentes.find((i) => i.id === alSeleccionar.mock.calls[0]?.[0]);
    expect(creado).toMatchObject({ tipo: 'FUGA_GAS', prioridad: 'P1', geometria: { type: 'Point', coordinates: [-77.2862, 1.2231] } });
    expect(creado?.timeline[0]).toMatchObject({ descripcion: 'Incidente creado desde llamada 123 (P1)', autor: 'op@argos.test' });
    const llamada = (await servicio.listarLlamadas()).find((l) => l.id === entrante.id);
    expect(llamada).toMatchObject({ incidenteId: creado?.id, estadoValidacion: 'Confirmado' });
    expect(alAvisar).toHaveBeenLastCalledWith(expect.stringContaining('creado desde la llamada'));
  });

  it('una llamada manual (sin id) se registra ya vinculada al incidente nuevo', async () => {
    const { servicio, acciones, alSeleccionar } = await montar();
    const antes = (await servicio.listarLlamadas()).length;

    await expect(acciones.current.crearIncidente(DATOS, null)).resolves.toBe(true);

    const llamadas = await servicio.listarLlamadas();
    expect(llamadas).toHaveLength(antes + 1);
    expect(llamadas.at(-1)).toMatchObject({ incidenteId: alSeleccionar.mock.calls[0]?.[0], estadoValidacion: 'Confirmado', canal: '123' });
  });

  it('si el servicio falla avisa del error y no selecciona nada', async () => {
    const { acciones, alSeleccionar, alAvisar } = await montar({ crearIncidente: () => Promise.reject(new Error('sin red')) });

    await expect(acciones.current.crearIncidente(DATOS, null)).resolves.toBe(false);

    expect(alSeleccionar).not.toHaveBeenCalled();
    expect(alAvisar).toHaveBeenLastCalledWith('sin red');
  });
});

const CANDIDATO: CandidatoDuplicado = { incidenteId: 'demo-1', codigo: 'O-1', distanciaM: 120, minutosDesde: 4, puntaje: 0.8 };

describe('useAccionesLlamada · crearIncidente con candidatos descartados', () => {
  it('deja en la bitácora del incidente nuevo cada posible duplicado que el operador rechazó', async () => {
    const { servicio, acciones, alSeleccionar } = await montar();

    await acciones.current.crearIncidente(DATOS, null, [CANDIDATO]);

    const creado = (await servicio.listarIncidentes()).find((i) => i.id === alSeleccionar.mock.calls[0]?.[0]);
    expect(creado?.timeline.map((e) => e.descripcion)).toEqual([
      'Incidente creado desde llamada 123 (P1)',
      'Posible duplicado de #O-1 (120 m, hace 4 min) descartado: incidente nuevo',
    ]);
    expect(creado?.timeline[1]?.autor).toBe('op@argos.test');
  });
});

describe('useAccionesLlamada · vincular', () => {
  it('una entrante queda vinculada al incidente, que lo anota en su bitácora', async () => {
    const { servicio, acciones, alSeleccionar, alAvisar } = await montar();
    const entrante = await servicio.registrarLlamada(DATOS);
    const antes = (await servicio.listarIncidentes()).find((i) => i.id === 'demo-1')?.timeline.length ?? 0;

    await expect(acciones.current.vincular(DATOS, entrante.id, 'demo-1')).resolves.toBe(true);

    const llamada = (await servicio.listarLlamadas()).find((l) => l.id === entrante.id);
    expect(llamada).toMatchObject({ incidenteId: 'demo-1', estadoValidacion: 'Confirmado' });
    const incidente = (await servicio.listarIncidentes()).find((i) => i.id === 'demo-1');
    expect(incidente?.timeline).toHaveLength(antes + 1);
    expect(incidente?.timeline.at(-1)).toMatchObject({
      descripcion: 'Llamada 123 de Residente vinculada al incidente (P1)',
      autor: 'op@argos.test',
    });
    expect(alSeleccionar).toHaveBeenCalledWith('demo-1');
    expect(alAvisar).toHaveBeenLastCalledWith(expect.stringContaining('vinculada al incidente'));
  });

  it('una llamada manual se registra ya vinculada, sin crear otro incidente', async () => {
    const { servicio, acciones } = await montar();
    const incidentesAntes = (await servicio.listarIncidentes()).length;

    await expect(acciones.current.vincular(DATOS, null, 'demo-1')).resolves.toBe(true);

    expect((await servicio.listarIncidentes()).length).toBe(incidentesAntes);
    expect((await servicio.listarLlamadas()).at(-1)).toMatchObject({ incidenteId: 'demo-1', estadoValidacion: 'Confirmado' });
  });

  it('si el incidente ya no existe avisa y no toca la llamada', async () => {
    const { servicio, acciones, alAvisar, alSeleccionar } = await montar();
    const entrante = await servicio.registrarLlamada(DATOS);

    await expect(acciones.current.vincular(DATOS, entrante.id, 'no-existe')).resolves.toBe(false);

    expect(alAvisar).toHaveBeenLastCalledWith('El incidente ya no está disponible');
    expect(alSeleccionar).not.toHaveBeenCalled();
    expect((await servicio.listarLlamadas()).find((l) => l.id === entrante.id)?.incidenteId).toBeNull();
  });
});
