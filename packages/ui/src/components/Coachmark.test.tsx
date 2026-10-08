// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Coachmark, posicionarPopover, type CoachmarkProps, type EtiquetasCoachmark } from './Coachmark';
import css from './Coachmark.css?raw';

afterEach(cleanup);

const etiquetas: EtiquetasCoachmark = {
  dialogo: 'Tutorial guiado',
  progreso: 'Paso 3 de 11',
  anterior: 'Anterior',
  siguiente: 'Siguiente',
  finalizar: 'Finalizar',
  saltar: 'Saltar tutorial',
  teclas: '← → para navegar · Esc para salir',
};

function montar(extra: Partial<CoachmarkProps> = {}) {
  const props = {
    ancla: null,
    titulo: 'Cola de incidentes',
    texto: 'Los incidentes se ordenan por prioridad.',
    indice: 2,
    total: 11,
    etiquetas,
    onAnterior: vi.fn(),
    onSiguiente: vi.fn(),
    onSaltar: vi.fn(),
    ...extra,
  } satisfies CoachmarkProps;
  return { props, ...render(<Coachmark {...props} />) };
}

/** Un ancla con caja conocida: jsdom no calcula layout. */
function crearAncla(caja: { top: number; left: number; width: number; height: number }): HTMLElement {
  const el = document.createElement('div');
  el.getBoundingClientRect = () => ({ ...caja, right: caja.left + caja.width, bottom: caja.top + caja.height, x: caja.left, y: caja.top, toJSON: () => ({}) });
  document.body.appendChild(el);
  return el;
}

describe('Coachmark', () => {
  it('es un diálogo con el título, el texto y el progreso «3/11»', () => {
    montar();
    const dialogo = screen.getByRole('dialog', { name: 'Tutorial guiado' });
    expect(dialogo.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByRole('heading', { name: 'Cola de incidentes' })).toBeTruthy();
    expect(screen.getByText('3/11').getAttribute('aria-label')).toBe('Paso 3 de 11');
    expect(screen.getByText('Los incidentes se ordenan por prioridad.')).toBeTruthy();
  });

  it('el texto va en una región aria-live para que el cambio de paso se anuncie', () => {
    montar({ pista: 'Pulsa F2 para probar' });
    const viva = screen.getByRole('heading', { name: 'Cola de incidentes' }).parentElement;
    expect(viva?.getAttribute('aria-live')).toBe('polite');
    expect(viva?.textContent).toContain('Pulsa F2 para probar');
  });

  it('los botones llaman a sus callbacks', () => {
    const { props } = montar();
    fireEvent.click(screen.getByRole('button', { name: 'Siguiente' }));
    fireEvent.click(screen.getByRole('button', { name: 'Anterior' }));
    fireEvent.click(screen.getByRole('button', { name: 'Saltar tutorial' }));
    expect(props.onSiguiente).toHaveBeenCalledTimes(1);
    expect(props.onAnterior).toHaveBeenCalledTimes(1);
    expect(props.onSaltar).toHaveBeenCalledTimes(1);
  });

  it('en el primer paso «Anterior» está deshabilitado y en el último «Siguiente» pasa a «Finalizar»', () => {
    const { rerender, props } = montar({ indice: 0 });
    expect((screen.getByRole('button', { name: 'Anterior' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<Coachmark {...props} indice={10} />);
    expect(screen.queryByRole('button', { name: 'Siguiente' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Finalizar' })).toBeTruthy();
  });

  it('el foco entra en el botón principal y se renueva con cada paso', () => {
    const { rerender, props } = montar();
    const principal = screen.getByRole('button', { name: 'Siguiente' });
    expect(document.activeElement).toBe(principal);
    (screen.getByRole('button', { name: 'Anterior' }) as HTMLElement).focus();
    rerender(<Coachmark {...props} indice={3} />);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Siguiente' }));
  });

  it('← y → navegan y Esc sale', () => {
    const { props } = montar();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(props.onSiguiente).toHaveBeenCalledTimes(1);
    expect(props.onAnterior).toHaveBeenCalledTimes(1);
    expect(props.onSaltar).toHaveBeenCalledTimes(1);
  });

  it('← no retrocede en el primer paso', () => {
    const { props } = montar({ indice: 0 });
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(props.onAnterior).not.toHaveBeenCalled();
  });

  it('en un campo de texto de la consola las flechas no navegan, pero Esc sí sale', () => {
    const campo = document.createElement('input');
    document.body.appendChild(campo);
    const { props } = montar();
    fireEvent.keyDown(campo, { key: 'ArrowRight' });
    expect(props.onSiguiente).not.toHaveBeenCalled();
    fireEvent.keyDown(campo, { key: 'Escape' });
    expect(props.onSaltar).toHaveBeenCalledTimes(1);
    campo.remove();
  });

  it('atrapa el foco: Tab desde el último botón vuelve al primero y Shift+Tab, al revés', () => {
    montar();
    const saltar = screen.getByRole('button', { name: 'Saltar tutorial' });
    const siguiente = screen.getByRole('button', { name: 'Siguiente' });
    siguiente.focus();
    fireEvent.keyDown(siguiente, { key: 'Tab' });
    expect(document.activeElement).toBe(saltar);
    fireEvent.keyDown(saltar, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(siguiente);
  });

  it('si el foco está fuera del popover, Tab lo trae de vuelta', () => {
    const fuera = document.createElement('button');
    document.body.appendChild(fuera);
    montar();
    fuera.focus();
    fireEvent.keyDown(fuera, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Saltar tutorial' }));
    fuera.remove();
  });

  it('los atajos de la consola no llegan mientras dura el recorrido, salvo la tecla libre', () => {
    const alPulsar = vi.fn();
    document.addEventListener('keydown', alPulsar);
    const { rerender, props } = montar();
    fireEvent.keyDown(document.body, { key: 'j' });
    fireEvent.keyDown(document.body, { key: 'F2' });
    expect(alPulsar).not.toHaveBeenCalled();
    rerender(<Coachmark {...props} teclaLibre="F2" />);
    fireEvent.keyDown(document.body, { key: 'F2' });
    expect(alPulsar).toHaveBeenCalledTimes(1);
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(alPulsar).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', alPulsar);
  });

  it('al desmontarse deja de interceptar el teclado', () => {
    const alPulsar = vi.fn();
    document.addEventListener('keydown', alPulsar);
    const { unmount } = montar();
    unmount();
    fireEvent.keyDown(document.body, { key: 'j' });
    expect(alPulsar).toHaveBeenCalledTimes(1);
    document.removeEventListener('keydown', alPulsar);
  });

  it('sin ancla, o con un ancla que no se ve, no hay recorte: un solo telón', () => {
    const { container, rerender, props } = montar();
    expect(container.querySelector('.ag-coach')?.getAttribute('data-recorte')).toBe('false');
    expect(container.querySelectorAll('.ag-coach__pano')).toHaveLength(1);
    expect(container.querySelector('.ag-coach__anillo')).toBeNull();
    const oculta = crearAncla({ top: 0, left: 0, width: 0, height: 0 });
    rerender(<Coachmark {...props} ancla={oculta} />);
    expect(container.querySelector('.ag-coach')?.getAttribute('data-recorte')).toBe('false');
    oculta.remove();
  });

  it('con ancla visible recorta un hueco de 4 px de holgura rodeado por cuatro paños', () => {
    const ancla = crearAncla({ top: 100, left: 200, width: 300, height: 80 });
    const { container } = montar({ ancla });
    expect(container.querySelector('.ag-coach')?.getAttribute('data-recorte')).toBe('true');
    expect(container.querySelectorAll('.ag-coach__pano')).toHaveLength(4);
    const anillo = container.querySelector<HTMLElement>('.ag-coach__anillo');
    expect(anillo?.style.top).toBe('96px');
    expect(anillo?.style.left).toBe('196px');
    expect(anillo?.style.width).toBe('308px');
    expect(anillo?.style.height).toBe('88px');
    ancla.remove();
  });

  it('se recoloca cuando la ventana cambia de tamaño o el ancla se mueve', () => {
    let caja = { top: 100, left: 200, width: 300, height: 80 };
    const ancla = crearAncla(caja);
    ancla.getBoundingClientRect = () => ({ ...caja, right: 0, bottom: 0, x: 0, y: 0, toJSON: () => ({}) });
    const { container } = montar({ ancla });
    expect(container.querySelector<HTMLElement>('.ag-coach__anillo')?.style.top).toBe('96px');
    caja = { top: 300, left: 200, width: 300, height: 80 };
    fireEvent(window, new Event('resize'));
    expect(container.querySelector<HTMLElement>('.ag-coach__anillo')?.style.top).toBe('296px');
    ancla.remove();
  });

  it('marca el movimiento reducido para apagar las transiciones', () => {
    const { container, rerender, props } = montar();
    expect(container.querySelector('.ag-coach')?.getAttribute('data-movimiento')).toBe('normal');
    rerender(<Coachmark {...props} reducirMovimiento />);
    expect(container.querySelector('.ag-coach')?.getAttribute('data-movimiento')).toBe('reducido');
    expect(css).toMatch(/\[data-movimiento="reducido"\][^{]*\{ transition: none/);
    expect(css).toContain('prefers-reduced-motion');
  });

  it('no usa colores sueltos ni degradados en su hoja de estilos', () => {
    expect(css).toContain('.ag-coach');
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(|gradient|blur/i);
  });
});

describe('posicionarPopover', () => {
  const pantalla = { ancho: 1280, alto: 800 };
  const popover = { ancho: 360, alto: 200 };

  it('sin ancla o con «centro» se centra en la pantalla o en el ancla', () => {
    expect(posicionarPopover(null, popover, pantalla, 'abajo')).toEqual({ top: 300, left: 460 });
    const ancla = { top: 100, left: 100, width: 400, height: 300 };
    expect(posicionarPopover(ancla, popover, pantalla, 'centro')).toEqual({ top: 150, left: 120 });
  });

  it('abajo y arriba se pegan al ancla con 12 px de separación y se centran en horizontal', () => {
    const ancla = { top: 0, left: 400, width: 200, height: 40 };
    expect(posicionarPopover(ancla, popover, pantalla, 'abajo')).toEqual({ top: 52, left: 320 });
    const baja = { top: 700, left: 400, width: 200, height: 40 };
    expect(posicionarPopover(baja, popover, pantalla, 'arriba')).toEqual({ top: 488, left: 320 });
  });

  it('derecha e izquierda se centran en vertical', () => {
    const ancla = { top: 300, left: 400, width: 200, height: 100 };
    expect(posicionarPopover(ancla, popover, pantalla, 'derecha')).toEqual({ top: 250, left: 612 });
    expect(posicionarPopover(ancla, popover, pantalla, 'izquierda')).toEqual({ top: 250, left: 28 });
  });

  it('si el lado pedido no cabe, usa el opuesto', () => {
    const alBorde = { top: 300, left: 1100, width: 160, height: 100 };
    expect(posicionarPopover(alBorde, popover, pantalla, 'derecha').left).toBe(1100 - 12 - 360);
    const arriba = { top: 20, left: 400, width: 200, height: 40 };
    expect(posicionarPopover(arriba, popover, pantalla, 'arriba').top).toBe(72);
  });

  it('acota el eje libre a la pantalla', () => {
    const esquina = { top: 0, left: 1240, width: 40, height: 40 };
    const pos = posicionarPopover(esquina, popover, pantalla, 'abajo');
    expect(pos.left).toBe(1280 - 360 - 12);
    expect(pos.top).toBe(52);
  });

  it('si no cabe en ningún lado se centra en el ancla', () => {
    const enorme = { top: 0, left: 0, width: 1280, height: 800 };
    expect(posicionarPopover(enorme, popover, pantalla, 'abajo')).toEqual({ top: 300, left: 460 });
  });

  it('nunca sale de la pantalla aunque el popover sea mayor que ella', () => {
    const pos = posicionarPopover(null, { ancho: 2000, alto: 2000 }, pantalla, 'centro');
    expect(pos).toEqual({ top: 12, left: 12 });
  });
});
