// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { EventoRecurso, Incidente, Llamada, Recurso } from '@argos/shared';
import { IncidentTimeline } from './IncidentTimeline';

afterEach(cleanup);

const T = (min: number) => new Date(Date.UTC(2026, 9, 7, 23, min)).toISOString();

const incidente: Incidente = {
  id: 'inc-1',
  titulo: 'Fuga de gas',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'FUGA_GAS',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [0, 0] },
  timeline: [],
  creado_en: T(24),
};

const llamada: Llamada = {
  id: 'l1',
  canal: '123',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: { lat: 0, lng: 0 },
  narrativa: '',
  reportante: null,
  callback: null,
  incidenteId: 'inc-1',
  estadoValidacion: 'Confirmado',
  operadorId: null,
  creadoEn: T(23),
};

const recurso: Recurso = { id: 'r1', tipo: 'Bomberos', estado_actual: 'EN_RUTA', incidente_asignado_id: 'inc-1', etiqueta: 'U01' };
const evento = (hacia: EventoRecurso['hacia'], min: number): EventoRecurso => ({
  id: `e-${hacia}`,
  recursoId: 'r1',
  incidenteId: 'inc-1',
  desde: 'DISPONIBLE',
  hacia,
  origen: 'MANUAL',
  creadoEn: T(min),
});

describe('IncidentTimeline', () => {
  it('marca el hito actual con AHORA, muestra la ETA real con su barra y agrupa los pendientes en una línea', () => {
    render(
      <IncidentTimeline
        incidente={incidente}
        llamadas={[llamada]}
        eventos={[evento('ASIGNADO', 25), evento('EN_RUTA', 25)]}
        recursos={[recurso]}
        indicativos={new Map([['r1', 'U01']])}
        etas={new Map([['r1', { progreso: 0.4, restanteSeg: 160 }]])}
      />,
    );
    const items = within(screen.getByRole('list', { name: 'Línea de tiempo' })).getAllByRole('listitem');
    expect(items.map((i) => i.getAttribute('data-estado'))).toEqual(['hecho', 'hecho', 'hecho', 'actual', 'pendiente']);
    expect(items[0]?.textContent).toContain('Llamada recibida · 123');
    expect(items[2]?.textContent).toContain('U01 despachada · bomberos');
    expect(items[3]?.textContent).toContain('Ahora');
    expect(items[3]?.textContent).toContain('U01 en ruta · ETA 02:40');
    expect(screen.getByRole('progressbar', { name: 'Avance de U01 hacia el incidente' }).getAttribute('aria-valuenow')).toBe('40');
    expect(items[4]?.textContent).toContain('En escena · contenido · resuelto');
  });

  it('sin llamadas vinculadas no muestra «Llamada recibida» y el incidente creado es el actual', () => {
    render(<IncidentTimeline incidente={incidente} llamadas={[]} eventos={[]} recursos={[]} indicativos={new Map()} />);
    const items = within(screen.getByRole('list', { name: 'Línea de tiempo' })).getAllByRole('listitem');
    expect(items[0]?.textContent).toContain('Incidente creado');
    expect(items[0]?.getAttribute('data-estado')).toBe('actual');
    expect(screen.queryByText(/Llamada recibida/)).toBeNull();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
