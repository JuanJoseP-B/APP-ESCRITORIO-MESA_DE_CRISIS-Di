// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Incidente, Llamada, Recurso } from '@argos/shared';
import { BORRADOR_VACIO } from '../domain/llamadas';
import { Login } from '../components/Login';
import { BandejaEntrantes } from '../layout/BandejaEntrantes';
import { BarraEstado } from '../layout/BarraEstado';
import { ColaIncidentes } from '../layout/ColaIncidentes';
import { AvisoDuplicado } from '../layout/AvisoDuplicado';
import { FormularioLlamada } from '../layout/FormularioLlamada';
import { PanelDetalle } from '../layout/PanelDetalle';
import { TableroUnidades } from '../layout/TableroUnidades';
import { IdiomaProvider } from './IdiomaProvider';

afterEach(cleanup);

const AHORA = Date.parse('2026-10-08T12:00:00Z');
const enIngles = (ui: React.ReactNode) => render(<IdiomaProvider inicial="en">{ui}</IdiomaProvider>);

const recurso: Recurso = { id: 'r1', tipo: 'Ambulancia', etiqueta: 'M10', estado_actual: 'DISPONIBLE', incidente_asignado_id: null };
const incidente: Incidente = {
  id: 'inc-0001',
  titulo: 'Incendio en bodega',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'FUGA_GAS',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [-77.28, 1.22] },
  timeline: [],
};
const llamada: Llamada = {
  id: 'l1',
  canal: 'VHF',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: { lat: 1.22, lng: -77.28 },
  narrativa: '',
  reportante: null,
  callback: null,
  incidenteId: null,
  estadoValidacion: 'No confirmado',
  operadorId: null,
  creadoEn: new Date(AHORA - 100_000).toISOString(),
};

describe('la consola en inglés', () => {
  it('la barra de estado', () => {
    enIngles(
      <BarraEstado hora={AHORA} zona="UTC" turno="carbon" operador="op@argos.test" enlace="EN_VIVO" entrantes={2} onCerrarSesion={vi.fn()} onAbrirAjustes={vi.fn()} />,
    );
    expect(screen.getByRole('banner', { name: 'Status bar' })).toBeTruthy();
    expect(screen.getByText(/Night shift/)).toBeTruthy();
    expect(screen.getByRole('status', { name: 'Link: Live' })).toBeTruthy();
    expect(screen.getByRole('status', { name: '2 incoming calls' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Settings' })).toBeTruthy();
  });

  it('la cola y la bandeja de entrantes', () => {
    enIngles(
      <ColaIncidentes incidentes={[incidente]} recursos={[]} llamadas={[llamada]} ahora={AHORA} seleccionadoId={null} onSeleccionar={vi.fn()} onAbrirLlamada={vi.fn()} />,
    );
    expect(screen.getByRole('tab', { name: /Active/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Incendio en bodega, priority P1, Open, 0 units, 0 calls' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Open call VHF, Gas leak, P1' })).toBeTruthy();
  });

  it('la bandeja vacía', () => {
    enIngles(<BandejaEntrantes llamadas={[]} ahora={AHORA} onAbrir={vi.fn()} />);
    expect(screen.getByText('No incoming calls')).toBeTruthy();
  });

  it('el detalle traduce estados, unidades y acciones', () => {
    enIngles(
      <PanelDetalle
        incidente={incidente}
        recursos={[recurso]}
        zonas={[]}
        ahora={AHORA}
        onCambiarEstadoIncidente={vi.fn()}
        onCambiarEstadoRecurso={vi.fn()}
        onCambiarOcupacion={vi.fn()}
      />,
    );
    expect(screen.getByText('Critical')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Mark Contained' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Ambulance M10' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Dispatch M10' }).textContent).toBe('DISPATCH');
  });

  it('el tablero traduce el estado completo y su abreviatura', () => {
    enIngles(<TableroUnidades recursos={[recurso]} incidenteSeleccionadoId={null} onSeleccionarUnidad={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'M10, Ambulance, Available' }).textContent).toContain('AVAIL');
    expect(screen.getByText('1/1 avail.')).toBeTruthy();
  });

  it('el formulario de llamada: etiquetas, opciones y errores', async () => {
    enIngles(
      <FormularioLlamada
        inicial={BORRADOR_VACIO}
        entrante={false}
        ubicacion={null}
        onUbicacionCambia={vi.fn()}
        incidentes={[]}
        ahora={AHORA}
        onCerrar={vi.fn()}
        onCrearIncidente={vi.fn().mockResolvedValue(true)}
        onVincular={vi.fn().mockResolvedValue(true)}
        onResaltarIncidente={vi.fn()}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Call log' })).toBeTruthy();
    expect(screen.getByLabelText('Emergency type')).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Gas leak' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'VHF radio' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Create incident/ }));
    expect(screen.getByText('Say the emergency type')).toBeTruthy();
    expect(screen.getByText('Latitude between -90 and 90')).toBeTruthy();
  });

  it('el aviso de duplicados', () => {
    enIngles(
      <AvisoDuplicado candidatos={[{ incidenteId: 'a', codigo: 'A3F', distanciaM: 120, minutosDesde: 4, puntaje: 0.9 }]} onVincular={vi.fn()} onResaltar={vi.fn()} />,
    );
    expect(screen.getByRole('region', { name: 'Possible duplicates' })).toBeTruthy();
    expect(screen.getByText('120 m, 4 min ago')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Link to #A3F' }).textContent).toBe('Link');
  });

  it('el acceso de operador', () => {
    enIngles(<Login onIniciarSesion={vi.fn()} error={null} />);
    expect(screen.getByRole('form', { name: 'Operator sign-in' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeTruthy();
  });
});
