// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PreferenciasProvider, usePreferencias } from '../hooks/usePreferencias';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { reproductor } from '../services/reproductorSonidos';
import { BarraEstado } from './BarraEstado';
import { PanelAjustes } from './PanelAjustes';

vi.mock('../services/reproductorSonidos', () => ({ reproductor: { activar: vi.fn(), configurar: vi.fn(), reproducir: vi.fn() } }));

/** La barra con su altavoz y el panel abierto, unidos por las preferencias como en la consola. */
function Consola() {
  const { preferencias, fijar } = usePreferencias();
  return (
    <>
      <BarraEstado
        hora={Date.UTC(2026, 9, 8, 12)}
        zona="UTC"
        turno="crema"
        operador="op@argos.test"
        enlace="EN_VIVO"
        sonidoActivo={preferencias.sonido}
        onAlternarSonido={() => fijar({ sonido: !preferencias.sonido })}
      />
      <PanelAjustes onCerrar={vi.fn()} />
    </>
  );
}

function montar() {
  render(
    <IdiomaProvider inicial="es">
      <PreferenciasProvider>
        <Consola />
      </PreferenciasProvider>
    </IdiomaProvider>,
  );
  return within(screen.getByRole('region', { name: 'Sonido' }));
}

const altavoz = () => screen.getByRole('button', { name: 'Silenciar sonido' });

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});
afterEach(cleanup);

describe('ajustes de sonido', () => {
  it('arranca activado al 60 y se lo pasa al reproductor', () => {
    const seccion = montar();
    expect(seccion.getByRole('switch', { name: 'Sonidos de la consola' }).getAttribute('aria-checked')).toBe('true');
    expect((seccion.getByRole('slider', { name: /Volumen/ }) as HTMLInputElement).value).toBe('60');
    expect(reproductor.configurar).toHaveBeenLastCalledWith({ volumen: 60, silenciado: false });
  });

  it('el volumen se aplica al instante y se recuerda', () => {
    const seccion = montar();
    fireEvent.change(seccion.getByRole('slider', { name: /Volumen/ }), { target: { value: '35' } });
    expect(reproductor.configurar).toHaveBeenLastCalledWith({ volumen: 35, silenciado: false });
    expect(localStorage.getItem('argos.volumen')).toBe('35');
  });

  it('«Probar» activa el audio dentro del clic y hace sonar un aviso', async () => {
    const seccion = montar();
    await userEvent.click(seccion.getByRole('button', { name: 'Probar' }));
    expect(reproductor.activar).toHaveBeenCalled();
    expect(reproductor.reproducir).toHaveBeenCalledWith('llamadaP2');
  });

  it('apagar el interruptor silencia, lo recuerda y deja sin uso el volumen y «Probar»', async () => {
    const seccion = montar();
    await userEvent.click(seccion.getByRole('switch', { name: 'Sonidos de la consola' }));
    expect(reproductor.configurar).toHaveBeenLastCalledWith({ volumen: 60, silenciado: true });
    expect(localStorage.getItem('argos.sonido')).toBe('false');
    expect((seccion.getByRole('slider', { name: /Volumen/ }) as HTMLInputElement).disabled).toBe(true);
    expect((seccion.getByRole('button', { name: 'Probar' }) as HTMLButtonElement).disabled).toBe(true);
    expect(altavoz().getAttribute('aria-pressed')).toBe('true');
  });

  it('el altavoz de la barra silencia y reactiva, y el interruptor lo refleja', async () => {
    const seccion = montar();
    expect(altavoz().getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(altavoz());
    expect(reproductor.configurar).toHaveBeenLastCalledWith({ volumen: 60, silenciado: true });
    expect(seccion.getByRole('switch', { name: 'Sonidos de la consola' }).getAttribute('aria-checked')).toBe('false');
    expect(altavoz().getAttribute('title')).toBe('Activar sonido');
    await userEvent.click(altavoz());
    expect(reproductor.configurar).toHaveBeenLastCalledWith({ volumen: 60, silenciado: false });
    expect(localStorage.getItem('argos.sonido')).toBe('true');
  });

  it('sin `onAlternarSonido` la barra no ofrece el altavoz', () => {
    render(<BarraEstado hora={0} zona="UTC" turno="crema" operador="" enlace="EN_VIVO" />);
    expect(screen.queryByRole('button', { name: 'Silenciar sonido' })).toBeNull();
  });
});
