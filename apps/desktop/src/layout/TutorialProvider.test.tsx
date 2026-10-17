// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLAVE_TUTORIAL_VISTO } from '../domain/tutorial';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { TutorialProvider, useTutorial, type PreparacionTutorial, type SimulacionPausable } from './TutorialProvider';

function Arranque() {
  const tutorial = useTutorial();
  return (
    <>
      <button onClick={tutorial?.iniciar}>Iniciar</button>
      <span data-testid="visto">{String(tutorial?.visto)}</span>
      <span data-testid="activo">{String(tutorial?.activo)}</span>
    </>
  );
}

function preparacionFalsa() {
  return { expandirCola: vi.fn(), expandirDetalle: vi.fn(), seleccionarPrimero: vi.fn(), cerrarFormulario: vi.fn() } satisfies PreparacionTutorial;
}

function montar(preparacion: PreparacionTutorial = preparacionFalsa(), simulacion?: SimulacionPausable) {
  render(
    <IdiomaProvider>
      <TutorialProvider preparacion={preparacion} simulacion={simulacion}>
        <div data-tutorial="barra">barra</div>
        <Arranque />
      </TutorialProvider>
    </IdiomaProvider>,
  );
  return preparacion;
}

const siguiente = () => userEvent.click(screen.getByRole('button', { name: /^(Siguiente|Finalizar)$/ }));
const avanzarA = async (paso: number) => {
  for (let n = 1; n < paso; n++) await siguiente();
};
const iniciar = () => userEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
const progreso = () => screen.getByRole('dialog', { name: 'Tutorial guiado' }).querySelector('.ag-coach__progreso')?.textContent;

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('TutorialProvider', () => {
  it('no muestra nada hasta que se inicia, y al iniciar abre la bienvenida en 1/11', async () => {
    montar();
    expect(screen.queryByRole('dialog')).toBeNull();
    await iniciar();
    expect(progreso()).toBe('1/11');
    expect(screen.getByRole('heading', { name: 'Bienvenido a ARGOS' })).toBeTruthy();
    expect(screen.getByTestId('activo').textContent).toBe('true');
  });

  it('Siguiente y Anterior recorren los pasos; la flecha derecha también avanza', async () => {
    montar();
    await iniciar();
    await siguiente();
    expect(progreso()).toBe('2/11');
    expect(screen.getByRole('heading', { name: 'Barra de estado' })).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(progreso()).toBe('3/11');
    await userEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    expect(progreso()).toBe('2/11');
  });

  it('antes de cada paso cumple lo que pide: paneles abiertos e incidente seleccionado', async () => {
    const prep = montar();
    await iniciar();
    expect(prep.expandirCola).not.toHaveBeenCalled();
    await avanzarA(3); // entrantes (desde el paso 1)
    expect(prep.expandirCola).toHaveBeenCalledTimes(1);
    await siguiente(); // registro
    expect(prep.expandirDetalle).toHaveBeenCalledTimes(1);
    expect(prep.seleccionarPrimero).not.toHaveBeenCalled();
    for (let n = 0; n < 4; n++) await siguiente(); // duplicados, cola, mapa, detalle
    expect(progreso()).toBe('8/11');
    expect(prep.seleccionarPrimero).toHaveBeenCalledTimes(1);
    expect(prep.expandirDetalle).toHaveBeenCalledTimes(3); // registro, duplicados y detalle
  });

  it('resalta el ancla cuando está en pantalla y, si no está, muestra el paso centrado y sin recorte', async () => {
    montar();
    const barra = document.querySelector<HTMLElement>('[data-tutorial="barra"]');
    if (!barra) throw new Error('falta el ancla de prueba');
    barra.getBoundingClientRect = () => ({ top: 0, left: 0, width: 800, height: 40, right: 800, bottom: 40, x: 0, y: 0, toJSON: () => ({}) });
    await iniciar();
    expect(document.querySelector('.ag-coach')?.getAttribute('data-recorte')).toBe('false'); // la bienvenida no tiene ancla
    await siguiente(); // barra de estado
    expect(document.querySelector('.ag-coach')?.getAttribute('data-recorte')).toBe('true');
    await siguiente(); // entrantes: no existe en este árbol
    expect(progreso()).toBe('3/11');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(document.querySelector('.ag-coach')?.getAttribute('data-recorte')).toBe('false');
  });

  it('el paso 4 avanza solo al pulsar F2 y muestra la pista', async () => {
    montar();
    await iniciar();
    await avanzarA(4);
    expect(screen.getByText('Pulsa F2 para probar. El recorrido avanzará solo.')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(progreso()).toBe('4/11');
    fireEvent.keyDown(document.body, { key: 'F2' });
    expect(progreso()).toBe('5/11');
    expect(screen.getByRole('heading', { name: 'Duplicados' })).toBeTruthy();
  });

  it('F2 fuera del paso 4 no mueve el recorrido', async () => {
    montar();
    await iniciar();
    await avanzarA(2);
    fireEvent.keyDown(document.body, { key: 'F2' });
    expect(progreso()).toBe('2/11');
  });

  it('el paso 4 se puede saltar sin probar F2 y no cierra ningún formulario ajeno', async () => {
    const prep = montar();
    await iniciar();
    await avanzarA(6);
    expect(progreso()).toBe('6/11');
    expect(prep.cerrarFormulario).not.toHaveBeenCalled();
  });

  it('el formulario que abrió el paso 4 se cierra al salir de los pasos que lo muestran', async () => {
    const prep = montar();
    await iniciar();
    await avanzarA(4);
    fireEvent.keyDown(document.body, { key: 'F2' }); // paso 5: duplicados, aún con el formulario a la vista
    expect(prep.cerrarFormulario).not.toHaveBeenCalled();
    await siguiente(); // paso 6: cola
    expect(prep.cerrarFormulario).toHaveBeenCalledTimes(1);
  });

  it('el formulario abierto por el recorrido también se cierra al saltar', async () => {
    const prep = montar();
    await iniciar();
    await avanzarA(4);
    fireEvent.keyDown(document.body, { key: 'F2' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(prep.cerrarFormulario).toHaveBeenCalledTimes(1);
  });

  it('Saltar cierra el recorrido y lo recuerda como visto', async () => {
    montar();
    expect(screen.getByTestId('visto').textContent).toBe('false');
    await iniciar();
    await userEvent.click(screen.getByRole('button', { name: 'Saltar tutorial' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('visto').textContent).toBe('true');
    expect(localStorage.getItem(CLAVE_TUTORIAL_VISTO)).toBe('true');
  });

  it('Esc sale del recorrido', async () => {
    montar();
    await iniciar();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(localStorage.getItem(CLAVE_TUTORIAL_VISTO)).toBe('true');
  });

  it('Finalizar en el último paso cierra el recorrido; se puede repetir desde el principio', async () => {
    montar();
    await iniciar();
    await avanzarA(11);
    expect(progreso()).toBe('11/11');
    expect(screen.getByRole('heading', { name: 'Listo para operar' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'Finalizar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await iniciar();
    expect(progreso()).toBe('1/11');
  });

  it('un valor guardado de «visto» se respeta al montar', () => {
    localStorage.setItem(CLAVE_TUTORIAL_VISTO, 'true');
    montar();
    expect(screen.getByTestId('visto').textContent).toBe('true');
  });

  it('pausa la simulación mientras dura y la reanuda al salir si corría', async () => {
    const sim: SimulacionPausable & { reproduciendo: boolean } = {
      reproduciendo: true,
      alternar: vi.fn(() => {
        sim.reproduciendo = !sim.reproduciendo;
      }),
    };
    montar(preparacionFalsa(), sim);
    await iniciar();
    expect(sim.alternar).toHaveBeenCalledTimes(1);
    expect(sim.reproduciendo).toBe(false);
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(sim.alternar).toHaveBeenCalledTimes(2);
    expect(sim.reproduciendo).toBe(true);
  });

  it('no toca la simulación si ya estaba en pausa', async () => {
    const sim: SimulacionPausable & { reproduciendo: boolean } = { reproduciendo: false, alternar: vi.fn() };
    montar(preparacionFalsa(), sim);
    await iniciar();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(sim.alternar).not.toHaveBeenCalled();
  });

  it('descartar la invitación lo da por visto sin abrir el recorrido', async () => {
    function Rechazo() {
      const tutorial = useTutorial();
      return <button onClick={tutorial?.descartarInvitacion}>Rechazar</button>;
    }
    render(
      <IdiomaProvider>
        <TutorialProvider preparacion={preparacionFalsa()}>
          <Rechazo />
          <Arranque />
        </TutorialProvider>
      </IdiomaProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Rechazar' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('visto').textContent).toBe('true');
    expect(localStorage.getItem(CLAVE_TUTORIAL_VISTO)).toBe('true');
  });

  it('fuera del proveedor useTutorial devuelve null', () => {
    function Sonda() {
      return <span data-testid="sonda">{String(useTutorial())}</span>;
    }
    render(<Sonda />);
    expect(screen.getByTestId('sonda').textContent).toBe('null');
  });
});
