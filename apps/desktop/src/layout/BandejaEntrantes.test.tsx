// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Llamada } from '@argos/shared';
import { BandejaEntrantes, type BandejaEntrantesProps } from './BandejaEntrantes';

afterEach(cleanup);

const AHORA = Date.parse('2026-10-08T12:00:00Z');
const hace = (seg: number): string => new Date(AHORA - seg * 1000).toISOString();

const llamada = (id: string, extra: Partial<Llamada> = {}): Llamada => ({
  id,
  canal: '123',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: { lat: 1.22, lng: -77.28 },
  narrativa: '',
  reportante: null,
  callback: null,
  incidenteId: null,
  estadoValidacion: 'No confirmado',
  operadorId: null,
  creadoEn: hace(100),
  ...extra,
});

const props = (extra: Partial<BandejaEntrantesProps> = {}): BandejaEntrantesProps => ({
  llamadas: [],
  ahora: AHORA,
  onAbrir: vi.fn(),
  ...extra,
});

const filas = () => within(screen.getByRole('list', { name: 'Llamadas entrantes' })).getAllByRole('listitem');

describe('BandejaEntrantes', () => {
  it('sin llamadas lo indica', () => {
    render(<BandejaEntrantes {...props()} />);
    expect(screen.getByText('Sin llamadas entrantes')).toBeTruthy();
  });

  it('cada fila muestra prioridad, canal, tipo y el tiempo desde que entró', () => {
    render(<BandejaEntrantes {...props({ llamadas: [llamada('a', { canal: 'VHF', prioridad: 'P2', creadoEn: hace(125) })] })} />);
    const fila = filas()[0] as HTMLElement;
    expect(fila.textContent).toContain('P2');
    expect(fila.textContent).toContain('VHF');
    expect(fila.textContent).toContain('Fuga de gas');
    expect(within(fila).getByText('02:05').tagName).toBe('TIME');
  });

  it('ordena por prioridad y deja la más reciente arriba; ignora las ya vinculadas', () => {
    const llamadas = [
      llamada('p2', { prioridad: 'P2', creadoEn: hace(5) }),
      llamada('p1-vieja', { creadoEn: hace(300), canal: 'VHF' }),
      llamada('p1-nueva', { creadoEn: hace(60), canal: 'SENSOR' }),
      llamada('vinculada', { incidenteId: 'i1', estadoValidacion: 'Confirmado', canal: 'PRESENCIAL' }),
    ];
    render(<BandejaEntrantes {...props({ llamadas })} />);
    expect(filas().map((f) => f.textContent)).toEqual([
      expect.stringContaining('SENSOR'),
      expect.stringContaining('VHF'),
      expect.stringContaining('P2'),
    ]);
    expect(screen.getByRole('region').textContent).toContain('· 3');
  });

  it('resalta con "Nueva" solo la llamada que acaba de entrar', () => {
    render(
      <BandejaEntrantes
        {...props({ llamadas: [llamada('fresca', { creadoEn: hace(2) }), llamada('vieja', { creadoEn: hace(90), prioridad: 'P2' })] })}
      />,
    );
    const [fresca, vieja] = filas() as [HTMLElement, HTMLElement];
    expect(fresca.dataset['nueva']).toBe('true');
    expect(within(fresca).getByText('Nueva').className).toContain('motion-safe:animate-pulse');
    expect(vieja.dataset['nueva']).toBeUndefined();
    expect(within(vieja).queryByText('Nueva')).toBeNull();
  });

  it('el resaltado se apaga al pasar la ventana', () => {
    const llamadas = [llamada('a', { creadoEn: hace(2) })];
    const { rerender } = render(<BandejaEntrantes {...props({ llamadas })} />);
    expect(screen.getByText('Nueva')).toBeTruthy();
    rerender(<BandejaEntrantes {...props({ llamadas, ahora: AHORA + 30_000 })} />);
    expect(screen.queryByText('Nueva')).toBeNull();
  });

  it('Enter o clic sobre una fila abren la llamada', async () => {
    const abrir = vi.fn();
    render(<BandejaEntrantes {...props({ llamadas: [llamada('a')], onAbrir: abrir })} />);
    const boton = screen.getByRole('button', { name: /Abrir llamada 123, Fuga de gas, P1/ });
    await userEvent.click(boton);
    boton.focus();
    await userEvent.keyboard('{Enter}');
    expect(abrir).toHaveBeenCalledTimes(2);
    expect(abrir).toHaveBeenLastCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('marca la llamada abierta y permite descartar', async () => {
    const descartar = vi.fn();
    render(<BandejaEntrantes {...props({ llamadas: [llamada('a')], abiertaId: 'a', onDescartar: descartar })} />);
    expect(screen.getByRole('button', { name: /Abrir llamada/ }).getAttribute('aria-current')).toBe('true');
    await userEvent.click(screen.getByRole('button', { name: /Descartar llamada/ }));
    expect(descartar).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
  });

  it('se pliega y se despliega', async () => {
    render(<BandejaEntrantes {...props({ llamadas: [llamada('a')] })} />);
    await userEvent.click(screen.getByRole('button', { name: 'Plegar' }));
    expect(screen.queryByRole('button', { name: /Abrir llamada/ })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Desplegar' }));
    expect(screen.getByRole('button', { name: /Abrir llamada/ })).toBeTruthy();
  });
});
