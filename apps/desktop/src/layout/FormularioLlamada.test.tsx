// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Llamada } from '@argos/shared';
import { BORRADOR_VACIO, borradorDesdeLlamada } from '../domain/llamadas';
import { FormularioLlamada, type FormularioLlamadaProps } from './FormularioLlamada';

afterEach(cleanup);

const ENTRANTE: Llamada = {
  id: 'l1',
  canal: 'VHF',
  tipo: 'FUGA_GAS',
  prioridad: 'P1',
  ubicacion: { lat: 1.2233, lng: -77.2859 },
  narrativa: 'Olor a gas en la cuadra.',
  reportante: null,
  callback: null,
  incidenteId: null,
  estadoValidacion: 'No confirmado',
  operadorId: null,
  creadoEn: '2026-10-08T12:00:00.000Z',
};

function montar(extra: Partial<FormularioLlamadaProps> = {}) {
  const props: FormularioLlamadaProps = {
    inicial: BORRADOR_VACIO,
    entrante: false,
    ubicacion: null,
    onUbicacionCambia: vi.fn(),
    onCerrar: vi.fn(),
    onCrearIncidente: vi.fn().mockResolvedValue(true),
    ...extra,
  };
  return { props, ...render(<FormularioLlamada {...props} />) };
}

const campo = (nombre: string) => screen.getByLabelText(nombre) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

async function rellenarManual() {
  await userEvent.selectOptions(campo('Canal'), '123');
  await userEvent.selectOptions(campo('Prioridad'), 'P2');
  await userEvent.selectOptions(campo('Tipo de emergencia'), 'INCENDIO');
  await userEvent.type(campo('Latitud'), '1.2136');
  await userEvent.type(campo('Longitud'), '-77.2811');
}

describe('FormularioLlamada · apertura', () => {
  it('vacío (F2): el foco inicial cae en el primer campo, el canal', () => {
    montar();
    expect(screen.getByRole('dialog', { name: 'Registro de llamada' })).toBeTruthy();
    expect(screen.getByText(/Manual/)).toBeTruthy();
    expect(document.activeElement).toBe(campo('Canal'));
  });

  it('precargado desde una entrante: muestra sus datos y enfoca el primer campo vacío', () => {
    montar({ inicial: borradorDesdeLlamada(ENTRANTE), entrante: true });
    expect(screen.getByText(/Entrante/)).toBeTruthy();
    expect((campo('Canal') as HTMLSelectElement).value).toBe('VHF');
    expect((campo('Tipo de emergencia') as HTMLSelectElement).value).toBe('FUGA_GAS');
    expect((campo('Prioridad') as HTMLSelectElement).value).toBe('P1');
    expect((campo('Latitud') as HTMLInputElement).value).toBe('1.22330');
    expect((campo('Narrativa') as HTMLTextAreaElement).value).toBe('Olor a gas en la cuadra.');
    expect(document.activeElement).toBe(campo('Reportante'));
  });
});

describe('FormularioLlamada · atajos', () => {
  it('Esc cierra, también con el foco dentro de un campo', async () => {
    const { props } = montar();
    await userEvent.type(campo('Reportante'), 'Ana');
    await userEvent.keyboard('{Escape}');
    expect(props.onCerrar).toHaveBeenCalledTimes(1);
  });

  it('Ctrl+Enter confirma desde un campo de texto y cierra al guardarse', async () => {
    const { props } = montar({ inicial: borradorDesdeLlamada(ENTRANTE), entrante: true });
    await userEvent.type(campo('Reportante'), 'Patrulla P01');
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(props.onCerrar).toHaveBeenCalledTimes(1));
    expect(props.onCrearIncidente).toHaveBeenCalledWith({
      canal: 'VHF',
      tipo: 'FUGA_GAS',
      prioridad: 'P1',
      ubicacion: { lat: 1.2233, lng: -77.2859 },
      narrativa: 'Olor a gas en la cuadra.',
      reportante: 'Patrulla P01',
      callback: null,
    });
  });

  it('Enter a secas dentro de un campo no confirma', async () => {
    const { props } = montar({ inicial: borradorDesdeLlamada(ENTRANTE), entrante: true });
    await userEvent.type(campo('Reportante'), 'Ana{Enter}');
    expect(props.onCrearIncidente).not.toHaveBeenCalled();
    expect(props.onCerrar).not.toHaveBeenCalled();
  });
});

describe('FormularioLlamada · creación', () => {
  it('una llamada manual completa se crea con el botón', async () => {
    const { props } = montar();
    await rellenarManual();
    await userEvent.click(screen.getByRole('button', { name: /Crear incidente/ }));
    await waitFor(() => expect(props.onCerrar).toHaveBeenCalledTimes(1));
    expect(props.onCrearIncidente).toHaveBeenCalledWith(
      expect.objectContaining({ canal: '123', tipo: 'INCENDIO', prioridad: 'P2', ubicacion: { lat: 1.2136, lng: -77.2811 }, reportante: null }),
    );
  });

  it('incompleto: muestra los errores, enfoca el primero y no crea nada', async () => {
    const { props } = montar();
    await userEvent.click(screen.getByRole('button', { name: /Crear incidente/ }));
    expect(props.onCrearIncidente).not.toHaveBeenCalled();
    expect(props.onCerrar).not.toHaveBeenCalled();
    expect(screen.getAllByRole('alert').map((a) => a.textContent)).toEqual([
      'Indica por qué canal entró la llamada',
      'Indica la prioridad',
      'Indica el tipo de emergencia',
      'Latitud entre -90 y 90',
      'Longitud entre -180 y 180',
    ]);
    expect(document.activeElement).toBe(campo('Canal'));
  });

  it('si no se pudo crear, el formulario sigue abierto', async () => {
    const { props } = montar({ onCrearIncidente: vi.fn().mockResolvedValue(false) });
    await rellenarManual();
    await userEvent.click(screen.getByRole('button', { name: /Crear incidente/ }));
    await waitFor(() => expect(props.onCrearIncidente).toHaveBeenCalledTimes(1));
    expect(props.onCerrar).not.toHaveBeenCalled();
  });

  it('un segundo Ctrl+Enter mientras se guarda no crea otro incidente', async () => {
    let terminar: (ok: boolean) => void = () => undefined;
    const lenta = vi.fn(() => new Promise<boolean>((resolver) => (terminar = resolver)));
    const { props } = montar({ inicial: borradorDesdeLlamada(ENTRANTE), entrante: true, onCrearIncidente: lenta });
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(document.body, { key: 'Enter', ctrlKey: true });
    expect(lenta).toHaveBeenCalledTimes(1);
    terminar(true);
    await waitFor(() => expect(props.onCerrar).toHaveBeenCalledTimes(1));
  });
});

describe('FormularioLlamada · ubicación', () => {
  it('el clic en el mapa rellena latitud y longitud', () => {
    const { rerender, props } = montar();
    rerender(<FormularioLlamada {...props} ubicacion={{ lat: 1.2345678, lng: -77.9876543 }} />);
    expect((campo('Latitud') as HTMLInputElement).value).toBe('1.23457');
    expect((campo('Longitud') as HTMLInputElement).value).toBe('-77.98765');
  });

  it('escribir las coordenadas avisa de la ubicación solo cuando están completas y válidas', async () => {
    const { props } = montar();
    await userEvent.type(campo('Latitud'), '1.5');
    expect(props.onUbicacionCambia).toHaveBeenLastCalledWith(null);
    await userEvent.type(campo('Longitud'), '-77.25');
    expect(props.onUbicacionCambia).toHaveBeenLastCalledWith({ lat: 1.5, lng: -77.25 });
  });

  it('lo que el operador escribe no se pisa cuando el padre devuelve la misma ubicación', async () => {
    const { rerender, props } = montar();
    await userEvent.type(campo('Latitud'), '1.5');
    await userEvent.type(campo('Longitud'), '-77.25');
    rerender(<FormularioLlamada {...props} ubicacion={{ lat: 1.5, lng: -77.25 }} />);
    expect((campo('Latitud') as HTMLInputElement).value).toBe('1.5');
  });
});
