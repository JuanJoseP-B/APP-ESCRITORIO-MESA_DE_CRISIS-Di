// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { NuevaLlamada } from '@argos/shared';
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

function montar(extra: Partial<ServicioMesa> = {}) {
  const servicio: ServicioMesa = { ...crearServicioDemo({ ahora: () => AHORA }), ...extra };
  const alAvisar = vi.fn();
  const alSeleccionar = vi.fn();
  const { result } = renderHook(() =>
    useAccionesLlamada({ servicio, alSeleccionar, alAvisar, operador: 'op@argos.test', ahora: () => AHORA }),
  );
  return { servicio, alAvisar, alSeleccionar, acciones: result };
}

describe('useAccionesLlamada · crearIncidente', () => {
  it('con una llamada entrante crea el incidente, la vincula y lo selecciona', async () => {
    const { servicio, acciones, alSeleccionar, alAvisar } = montar();
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
    const { servicio, acciones, alSeleccionar } = montar();
    const antes = (await servicio.listarLlamadas()).length;

    await expect(acciones.current.crearIncidente(DATOS, null)).resolves.toBe(true);

    const llamadas = await servicio.listarLlamadas();
    expect(llamadas).toHaveLength(antes + 1);
    expect(llamadas.at(-1)).toMatchObject({ incidenteId: alSeleccionar.mock.calls[0]?.[0], estadoValidacion: 'Confirmado', canal: '123' });
  });

  it('si el servicio falla avisa del error y no selecciona nada', async () => {
    const { acciones, alSeleccionar, alAvisar } = montar({ crearIncidente: () => Promise.reject(new Error('sin red')) });

    await expect(acciones.current.crearIncidente(DATOS, null)).resolves.toBe(false);

    expect(alSeleccionar).not.toHaveBeenCalled();
    expect(alAvisar).toHaveBeenLastCalledWith('sin red');
  });
});
