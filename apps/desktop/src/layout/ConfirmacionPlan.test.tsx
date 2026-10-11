// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecomendacionAsesor, SnapshotAsesor } from '@argos/shared';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { ConfirmacionPlan } from './ConfirmacionPlan';

afterEach(cleanup);

const snapshot: SnapshotAsesor = {
  version: 1,
  generadoEn: '2026-10-07T12:00:00.000Z',
  incidente: {
    id: 'inc-1',
    codigo: 'IN1',
    tipo: 'FUGA_GAS',
    prioridad: 'P1',
    ubicacion: { lat: 1.2, lng: -77.2 },
    descripcion: 'Fuga',
    llamadasVinculadas: 1,
    minutosAbierto: 3,
    perimetroActual: null,
  },
  recursos: [
    { id: 'u01', indicativo: 'U01', tipo: 'Bomberos', estado: 'DISPONIBLE', incidenteId: null, ubicacion: { lat: 1.2, lng: -77.2 }, distanciaM: 640 },
    { id: 'm11', indicativo: 'M11', tipo: 'Ambulancia', estado: 'DISPONIBLE', incidenteId: null, ubicacion: { lat: 1.2, lng: -77.2 }, distanciaM: 1300 },
  ],
  refugios: [{ id: 'z1', nombre: 'Colegio Central', ubicacion: { lat: 1.2, lng: -77.2 }, ocupacion: 20, capacidad: 120, anillo: 'FUERA' }],
  contexto: { slaVencidos: [], unidadesEnZonaCaliente: [] },
};

const recomendacion: RecomendacionAsesor = {
  idRecomendacion: 'rec-1',
  unidades: [
    { idRecurso: 'u01', rol: 'Control y rescate', etaMin: 1 },
    { idRecurso: 'm11', rol: 'Atención prehospitalaria', etaMin: 2 },
  ],
  justificacion: 'Texto.',
  perimetroSugerido: { CALIENTE: 100, TIBIA: 300, EVACUACION: 800 },
  refugioSugeridoId: 'z1',
  advertencias: [],
  confianza: 'ALTA',
};

const montar = (rec: RecomendacionAsesor = recomendacion, idioma: 'es' | 'en' = 'es') => {
  const onConfirmar = vi.fn();
  const onCancelar = vi.fn();
  render(
    <IdiomaProvider inicial={idioma}>
      <ConfirmacionPlan snapshot={snapshot} recomendacion={rec} onConfirmar={onConfirmar} onCancelar={onCancelar} />
    </IdiomaProvider>,
  );
  return { onConfirmar, onCancelar };
};

const casilla = (nombre: RegExp) => screen.getByRole('checkbox', { name: nombre }) as HTMLInputElement;

describe('ConfirmacionPlan', () => {
  it('lista cada acción en una línea marcable, todas marcadas al abrir', () => {
    montar();
    expect(screen.getByRole('dialog', { name: 'Aplicar sugerencia · #IN1' })).toBeTruthy();
    const casillas = screen.getAllByRole('checkbox') as HTMLInputElement[];
    expect(casillas).toHaveLength(4);
    expect(casillas.every((c) => c.checked)).toBe(true);
    expect(casilla(/Despachar U01/).closest('label')?.textContent).toContain('Bomberos · Control y rescate · ETA 1 min');
    expect(casilla(/Despachar M11/)).toBeTruthy();
    expect(casilla(/Aplicar perímetro 100 \/ 300 \/ 800 m/)).toBeTruthy();
    expect(casilla(/Fijar refugio Colegio Central/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Confirmar 4 de 4/ })).toBeTruthy();
  });

  it('el foco entra en la primera acción', () => {
    montar();
    expect(document.activeElement).toBe(casilla(/Despachar U01/));
  });

  it('confirmar entrega solo las acciones marcadas (aplicación parcial)', async () => {
    const { onConfirmar } = montar();
    await userEvent.click(casilla(/Despachar M11/));
    await userEvent.click(casilla(/Fijar refugio/));
    expect(screen.getByRole('button', { name: /^Confirmar 2 de 4/ })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /^Confirmar 2 de 4/ }));
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect([...(onConfirmar.mock.calls[0]?.[0] as ReadonlySet<string>)].sort()).toEqual(['despachar:u01', 'perimetro']);
  });

  it('Enter confirma lo marcado, también con el foco en una casilla', async () => {
    const { onConfirmar } = montar();
    await userEvent.keyboard('{ }'); // Espacio desmarca la primera casilla enfocada
    expect(casilla(/Despachar U01/).checked).toBe(false);
    await userEvent.keyboard('{Enter}');
    expect(onConfirmar).toHaveBeenCalledTimes(1);
    expect([...(onConfirmar.mock.calls[0]?.[0] as ReadonlySet<string>)].sort()).toEqual(['despachar:m11', 'perimetro', 'refugio:z1']);
  });

  it('Esc cancela sin ejecutar nada', async () => {
    const { onConfirmar, onCancelar } = montar();
    await userEvent.keyboard('{Escape}');
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('el Esc de la confirmación no sube a los atajos globales (no cierra además la tarjeta)', async () => {
    const { onCancelar } = montar();
    const global = vi.fn();
    document.addEventListener('keydown', global);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', global);
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(global).not.toHaveBeenCalled();
  });

  it('con todo desmarcado no se puede confirmar, ni con Enter', async () => {
    const { onConfirmar } = montar();
    for (const c of screen.getAllByRole('checkbox')) await userEvent.click(c);
    const confirmar = screen.getByRole('button', { name: /^Confirmar 0 de 4/ }) as HTMLButtonElement;
    expect(confirmar.disabled).toBe(true);
    await userEvent.keyboard('{Enter}');
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('Enter sobre Cancelar cancela y no confirma', async () => {
    const { onConfirmar, onCancelar } = montar();
    screen.getByRole('button', { name: /^Cancelar/ }).focus();
    await userEvent.keyboard('{Enter}');
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onConfirmar).not.toHaveBeenCalled();
  });

  it('sin refugio ni unidades solo queda el perímetro', () => {
    montar({ ...recomendacion, unidades: [], refugioSugeridoId: null });
    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /^Confirmar 1 de 1/ })).toBeTruthy();
  });

  it('en inglés traduce las acciones', () => {
    montar(recomendacion, 'en');
    expect(screen.getByRole('dialog', { name: 'Apply suggestion · #IN1' })).toBeTruthy();
    expect(casilla(/Dispatch U01/)).toBeTruthy();
    expect(casilla(/Set shelter Colegio Central/)).toBeTruthy();
    expect(screen.getByRole('button', { name: /^Confirm 4 of 4/ })).toBeTruthy();
  });
});
