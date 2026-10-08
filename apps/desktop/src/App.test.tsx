// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { IdiomaProvider } from './i18n/IdiomaProvider';
import { crearEntornoSemilla } from './testing/entornoSemilla';

// MapLibre necesita WebGL, que jsdom no tiene: el mapa se sustituye por un hueco.
vi.mock('./layout/MapaTactico', () => ({ MapaTactico: () => null }));

beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});
afterEach(cleanup);

async function abrirConsola() {
  render(
    <IdiomaProvider inicial="es">
      <App crearEntorno={crearEntornoSemilla} />
    </IdiomaProvider>,
  );
  await screen.findByRole('banner', { name: 'Barra de estado' });
  await filaFuga(); // espera a que lleguen los datos del demo
}

function filaFuga() {
  return screen.findByRole('button', { name: /Fuga de gas en sector/ });
}

describe('App: atajos de navegación y despacho', () => {
  it('J selecciona el primer incidente de la cola y abre su detalle', async () => {
    await abrirConsola();
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('false');
    await userEvent.keyboard('j');
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('true');
    expect(await screen.findByRole('region', { name: 'Ficha del incidente' })).toBeTruthy();
  });

  it('D sin incidente seleccionado no hace nada', async () => {
    await abrirConsola();
    await userEvent.keyboard('d');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('D abre el despacho con la unidad libre más cercana preseleccionada, y Enter la despacha', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('d');
    const dialogo = await screen.findByRole('dialog', { name: /^Despachar · #/ });
    const sugerida = within(dialogo).getByRole('radio', { name: /P01/ }) as HTMLInputElement;
    expect(sugerida.checked).toBe(true);
    expect(document.activeElement).toBe(sugerida);

    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('dialog', { name: /^Despachar · #/ })).toBeNull();
    expect(await screen.findByRole('button', { name: /^P01, Policía, Despachado/ })).toBeTruthy();
  });

  it('Esc cancela el despacho sin asignar nada', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('d');
    await screen.findByRole('dialog', { name: /^Despachar · #/ });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /^Despachar · #/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'P01, Policía, Disponible' })).toBeTruthy();
  });

  it('el botón «Despachar unidad» del detalle abre el mismo despacho', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.click(await screen.findByRole('button', { name: /^Despachar unidad/ }));
    expect(await screen.findByRole('dialog', { name: /^Despachar · #/ })).toBeTruthy();
  });

  it('los atajos no se disparan escribiendo en un campo', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('{F2}');
    const campo = await screen.findByLabelText('Latitud');
    await userEvent.click(campo);
    await userEvent.keyboard('d');
    expect(screen.queryByRole('dialog', { name: /^Despachar · #/ })).toBeNull();
    expect((campo as HTMLInputElement).value).toContain('d');
  });
});

describe('App: hoja de atajos', () => {
  it('F1 abre la hoja y F1 de nuevo la cierra', async () => {
    await abrirConsola();
    await userEvent.keyboard('{F1}');
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
    await userEvent.keyboard('{F1}');
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).toBeNull();
  });

  it('«?» la abre y Esc la cierra devolviendo el foco', async () => {
    await abrirConsola();
    const fila = await filaFuga();
    fila.focus();
    await userEvent.keyboard('?');
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Atajos de teclado' })).toBeNull();
    expect(document.activeElement).toBe(fila);
  });

  it('con la hoja abierta los demás atajos no actúan', async () => {
    await abrirConsola();
    await userEvent.keyboard('{F1}');
    await screen.findByRole('dialog', { name: 'Atajos de teclado' });
    await userEvent.keyboard('j');
    expect((await filaFuga()).getAttribute('aria-pressed')).toBe('false');
  });

  it('desde Ajustes → Ayuda cierra los ajustes y abre la hoja', async () => {
    await abrirConsola();
    await userEvent.click(screen.getByRole('button', { name: 'Ajustes' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Atajos de teclado' }));
    expect(screen.queryByRole('dialog', { name: 'Ajustes' })).toBeNull();
    expect(await screen.findByRole('dialog', { name: 'Atajos de teclado' })).toBeTruthy();
  });
});

describe('App: asesor táctico', () => {
  const REGION = { name: 'Asesor táctico · motor de reglas' };

  it('A sin incidente seleccionado no hace nada', async () => {
    await abrirConsola();
    await userEvent.keyboard('a');
    expect(screen.queryByRole('region', REGION)).toBeNull();
  });

  it('A analiza unos instantes y muestra la recomendación del motor de reglas', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('a');
    expect(await screen.findByText('Analizando el incidente…')).toBeTruthy();
    expect(await screen.findByText('Sin unidades que despachar.', undefined, { timeout: 3000 })).toBeTruthy();
    const tarjeta = screen.getByRole('region', REGION);
    expect(within(tarjeta).getByText('100 / 300 / 800 m')).toBeTruthy();
    expect(within(tarjeta).getByText('Colegio Central · cupo libre 110')).toBeTruthy();
    expect(within(tarjeta).getByText('Alta')).toBeTruthy();
  });

  it('el botón [ASESOR] hace lo mismo y A o Esc cierran la tarjeta sin cambiar nada', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.click(await screen.findByRole('button', { name: 'Pedir una recomendación al asesor táctico' }));
    await screen.findByText('Sin unidades que despachar.', undefined, { timeout: 3000 });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('region', REGION)).toBeNull();
    await userEvent.keyboard('a');
    expect(await screen.findByRole('region', REGION)).toBeTruthy();
    await userEvent.keyboard('a');
    expect(screen.queryByRole('region', REGION)).toBeNull();
    // Nada cambió: la unidad libre sigue libre.
    expect(screen.getByRole('button', { name: 'P01, Policía, Disponible' })).toBeTruthy();
  });

  it('el despacho manual sigue funcionando con la tarjeta abierta', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.keyboard('a');
    await screen.findByText('Sin unidades que despachar.', undefined, { timeout: 3000 });
    await userEvent.keyboard('d');
    expect(await screen.findByRole('dialog', { name: /^Despachar · #/ })).toBeTruthy();
  });
});

describe('App: sugerencia del asesor', () => {
  const REGION = { name: 'Asesor táctico · motor de reglas' };

  /** Libera la U02 del demo para que Bomberos quede sin cubrir y el asesor tenga una unidad que proponer. */
  async function abrirAsesorConUnidadPorCubrir() {
    await abrirConsola();
    await userEvent.keyboard('j');
    await userEvent.click(await screen.findByRole('button', { name: 'Liberar U02' }));
    await userEvent.keyboard('a');
    await screen.findByText('Unidades recomendadas', undefined, { timeout: 3000 });
  }

  it('[APLICAR SUGERENCIA] abre la confirmación; Enter ejecuta solo lo marcado y deja el rastro en la bitácora', async () => {
    await abrirAsesorConUnidadPorCubrir();
    await userEvent.click(screen.getByRole('button', { name: 'APLICAR SUGERENCIA' }));
    const dialogo = await screen.findByRole('dialog', { name: /^Aplicar sugerencia · #/ });
    // Se omite el perímetro: solo se despacha la unidad y se fija el refugio.
    await userEvent.click(within(dialogo).getByRole('checkbox', { name: /Aplicar perímetro/ }));
    await userEvent.keyboard('{Enter}');

    expect(screen.queryByRole('dialog', { name: /^Aplicar sugerencia · #/ })).toBeNull();
    expect(screen.queryByRole('region', REGION)).toBeNull();
    expect(await screen.findByRole('button', { name: /^U0\d, Bomberos, Despachado/ })).toBeTruthy();
    const bitacora = await screen.findByText(/el operador aplicó la sugerencia en parte/);
    expect(bitacora.textContent).toMatch(/Asesor táctico \[[0-9a-f]{8}\] · /);
    expect(bitacora.textContent).toContain('Aceptado: despachar U0');
    expect(bitacora.textContent).toContain('refugio Colegio Central');
    expect(bitacora.textContent).toContain('Rechazado: perímetro 100/300/800 m.');
    expect(bitacora.textContent).toContain('ASESOR · demo@local');
  });

  it('Esc en la confirmación cancela sin cambiar nada y deja la tarjeta abierta', async () => {
    await abrirAsesorConUnidadPorCubrir();
    await userEvent.click(screen.getByRole('button', { name: 'APLICAR SUGERENCIA' }));
    await screen.findByRole('dialog', { name: /^Aplicar sugerencia · #/ });
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: /^Aplicar sugerencia · #/ })).toBeNull();
    expect(screen.getByRole('region', REGION)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^U0\d, Bomberos, Despachado/ })).toBeNull();
    expect(screen.queryByText(/Asesor táctico \[/)).toBeNull();
  });

  it('[DESCARTAR] cierra la tarjeta sin cambiar el estado y queda en la bitácora', async () => {
    await abrirAsesorConUnidadPorCubrir();
    await userEvent.click(screen.getByRole('button', { name: 'DESCARTAR' }));
    expect(screen.queryByRole('region', REGION)).toBeNull();
    const bitacora = await screen.findByText(/el operador descartó la sugerencia/);
    expect(bitacora.textContent).toContain('Aceptado: ninguna.');
    expect(bitacora.textContent).toContain('Rechazado: despachar U0');
    expect(screen.queryByRole('button', { name: /^U0\d, Bomberos, Despachado/ })).toBeNull();
  });
});

describe('App: incidente resuelto', () => {
  it('al marcarlo resuelto pasa a Cerrados y deja de analizarse su perímetro', async () => {
    await abrirConsola();
    await userEvent.keyboard('j');
    expect(await screen.findByText('Análisis del perímetro')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /Marcar resuelto/i }));
    expect(await screen.findByRole('tab', { name: 'Cerrados (1)' })).toBeTruthy();
    expect(screen.queryByText('Análisis del perímetro')).toBeNull();
  });
});
