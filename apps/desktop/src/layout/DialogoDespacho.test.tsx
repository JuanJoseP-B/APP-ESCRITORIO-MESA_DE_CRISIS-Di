// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EstadoRecurso, Incidente, Recurso } from '@argos/shared';
import { DialogoDespacho, type DialogoDespachoProps } from './DialogoDespacho';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const incidente: Incidente = {
  id: 'inc-1-a3f',
  titulo: 'Fuga de gas en sector',
  nivel_criticidad: 'Crítico',
  prioridad: 'P1',
  tipo: 'FUGA_GAS',
  estado: 'Abierto',
  geometria: { type: 'Point', coordinates: [-77.2811, 1.2136] },
  timeline: [],
};

const unidad = (id: string, estado: EstadoRecurso, lat: number | null, tipo: Recurso['tipo'] = 'Ambulancia'): Recurso => ({
  id,
  etiqueta: id,
  tipo,
  estado_actual: estado,
  incidente_asignado_id: null,
  base: lat === null ? null : { lat, lng: -77.2811 },
});

const recursos: readonly Recurso[] = [
  unidad('U01', 'DISPONIBLE', 1.2262, 'Bomberos'),
  unidad('M12', 'DISPONIBLE', 1.2141),
  unidad('P01', 'DISPONIBLE', 1.2186, 'Policía'),
  unidad('M10', 'INOPERATIVO', 1.2136),
  unidad('U02', 'ASIGNADO', 1.2136, 'Bomberos'),
];

function montar(extra: Partial<DialogoDespachoProps> = {}) {
  const props: DialogoDespachoProps = { incidente, recursos, onConfirmar: vi.fn(), onCancelar: vi.fn(), ...extra };
  return { props, ...render(<DialogoDespacho {...props} />) };
}

describe('DialogoDespacho', () => {
  it('lista solo las unidades libres, de la más cercana a la más lejana, con su distancia', () => {
    montar();
    const filas = within(screen.getByRole('dialog')).getAllByRole('radio');
    expect(filas.map((r) => (r as HTMLInputElement).value)).toEqual(['M12', 'P01', 'U01']);
    expect(screen.getByText('56 m')).toBeTruthy();
    expect(screen.getByText('1,4 km')).toBeTruthy();
  });

  it('deja preseleccionada la más cercana, la rotula como sugerida y le da el foco', () => {
    montar();
    const sugerida = screen.getByRole('radio', { name: /M12/ }) as HTMLInputElement;
    expect(sugerida.checked).toBe(true);
    expect(document.activeElement).toBe(sugerida);
    expect(screen.getByText('Sugerida')).toBeTruthy();
    expect((screen.getByRole('radio', { name: /U01/ }) as HTMLInputElement).checked).toBe(false);
  });

  it('Enter despacha la unidad preseleccionada', async () => {
    const { props } = montar();
    await userEvent.keyboard('{Enter}');
    expect(props.onConfirmar).toHaveBeenCalledTimes(1);
    expect(props.onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 'M12' }));
  });

  it('las flechas cambian la elección y Enter despacha la elegida', async () => {
    // jsdom no trae CSS.escape y user-event lo usa para recorrer el grupo de radios.
    vi.stubGlobal('CSS', { escape: (s: string) => s });
    const { props } = montar();
    await userEvent.keyboard('{ArrowDown}');
    expect((screen.getByRole('radio', { name: /P01/ }) as HTMLInputElement).checked).toBe(true);
    await userEvent.keyboard('{Enter}');
    expect(props.onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 'P01' }));
  });

  it('elegir con el ratón también cambia la unidad a despachar', async () => {
    const { props } = montar();
    await userEvent.click(screen.getByRole('radio', { name: /U01/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Despachar' }));
    expect(props.onConfirmar).toHaveBeenCalledWith(expect.objectContaining({ id: 'U01' }));
  });

  it('Esc cancela sin despachar, aunque el foco esté en la lista', async () => {
    const { props } = montar();
    await userEvent.keyboard('{Escape}');
    expect(props.onCancelar).toHaveBeenCalledTimes(1);
    expect(props.onConfirmar).not.toHaveBeenCalled();
  });

  it('el Esc de la lista no sube a los atajos globales (no cierra además otra cosa)', async () => {
    const { props } = montar();
    const global = vi.fn();
    document.addEventListener('keydown', global);
    await userEvent.keyboard('{Escape}');
    document.removeEventListener('keydown', global);
    expect(props.onCancelar).toHaveBeenCalledTimes(1);
    expect(global).not.toHaveBeenCalled();
  });

  it('Enter sobre el botón Cancelar cancela en vez de despachar', async () => {
    const { props } = montar();
    screen.getByRole('button', { name: 'Cancelar' }).focus();
    await userEvent.keyboard('{Enter}');
    expect(props.onCancelar).toHaveBeenCalledTimes(1);
    expect(props.onConfirmar).not.toHaveBeenCalled();
  });

  it('los botones muestran su tecla con <kbd> y anuncian el atajo', () => {
    montar();
    const confirmar = screen.getByRole('button', { name: 'Despachar' });
    expect(confirmar.querySelector('kbd')?.textContent).toBe('Enter');
    expect(confirmar.getAttribute('aria-keyshortcuts')).toBe('Enter');
    const cancelar = screen.getByRole('button', { name: 'Cancelar' });
    expect(cancelar.querySelector('kbd')?.textContent).toBe('Esc');
    expect(cancelar.getAttribute('aria-keyshortcuts')).toBe('Escape');
  });

  it('sin unidades libres lo dice y no deja despachar', async () => {
    const { props } = montar({ recursos: [unidad('U02', 'ASIGNADO', 1.2136)] });
    expect(screen.getByText('No hay unidades disponibles para despachar')).toBeTruthy();
    expect(screen.queryByRole('radio')).toBeNull();
    expect((screen.getByRole('button', { name: 'Despachar' }) as HTMLButtonElement).disabled).toBe(true);
    await userEvent.keyboard('{Enter}');
    expect(props.onConfirmar).not.toHaveBeenCalled();
  });

  it('no es modal y al cerrarse devuelve el foco a quien lo tenía', () => {
    const opener = document.createElement('button');
    document.body.append(opener);
    opener.focus();
    const { unmount } = montar();
    expect(screen.getByRole('dialog').getAttribute('aria-modal')).toBe('false');
    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });
});
