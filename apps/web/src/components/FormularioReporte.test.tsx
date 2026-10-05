// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormularioReporte } from './FormularioReporte';
import type { EstadoGeolocalizacion } from '../hooks/useGeolocalizacion';

// MapLibre necesita WebGL, que jsdom no ofrece: el mapa se sustituye por un botón que simula el arrastre.
vi.mock('./SelectorUbicacion', () => ({
  SelectorUbicacion: ({
    ubicacion,
    onCambiar,
  }: {
    ubicacion: { lat: number; lng: number } | null;
    onCambiar: (c: { lat: number; lng: number }) => void;
  }) => (
    <button type="button" onClick={() => onCambiar({ lat: -33.5, lng: -70.7 })}>
      {ubicacion ? `marcador ${ubicacion.lat},${ubicacion.lng}` : 'sin marcador'}
    </button>
  ),
}));

afterEach(cleanup);

const conUbicacion: EstadoGeolocalizacion = { estado: 'ok', coordenadas: { lat: -33.4, lng: -70.6 } };
const ID = '0b9f2c1e-1111-4222-8333-444455556666';

function montar(geo: EstadoGeolocalizacion, onEnviar = vi.fn().mockResolvedValue(ID)) {
  const onSolicitarUbicacion = vi.fn();
  render(<FormularioReporte geolocalizacion={geo} onSolicitarUbicacion={onSolicitarUbicacion} onEnviar={onEnviar} />);
  return { onEnviar, onSolicitarUbicacion };
}

describe('FormularioReporte', () => {
  it('pide la ubicación al pulsar el botón', async () => {
    const { onSolicitarUbicacion } = montar({ estado: 'inactivo' });
    await userEvent.click(screen.getByRole('button', { name: 'Usar mi ubicación' }));
    expect(onSolicitarUbicacion).toHaveBeenCalledOnce();
  });

  it('no envía sin tipo ni ubicación y muestra los errores', async () => {
    const { onEnviar } = montar({ estado: 'inactivo' });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    const alerta = screen.getByRole('alert').textContent ?? '';
    expect(alerta).toContain('tipo');
    expect(alerta).toContain('ubicación');
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('muestra el mensaje cuando la geolocalización falla', () => {
    montar({ estado: 'error', mensaje: 'Permiso de ubicación denegado.' });
    expect(screen.getByRole('alert').textContent).toContain('denegado');
  });

  it('envía el tipo elegido y las coordenadas y confirma con el ID', async () => {
    const { onEnviar } = montar(conUbicacion);
    await userEvent.click(screen.getByRole('radio', { name: /Creciente súbita/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    expect(onEnviar).toHaveBeenCalledWith({ tipo: 'CRECIENTE_SUBITA', lat: -33.4, lng: -70.6 }, null);
    expect(await screen.findByRole('alertdialog')).toBeTruthy();
    expect(screen.getByRole('status').textContent).toContain('Guarda este código');
    expect(screen.getByTestId('id-reporte').textContent).toBe('#0B9F2C1E');
    expect(screen.getByText(`ID completo: ${ID}`)).toBeTruthy();
  });

  it('usa la ubicación ajustada en el mapa en lugar de la del GPS', async () => {
    const { onEnviar } = montar(conUbicacion);
    await userEvent.click(screen.getByRole('radio', { name: /Fuga de gas/ }));
    await userEvent.click(screen.getByRole('button', { name: /marcador/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    expect(onEnviar).toHaveBeenCalledWith({ tipo: 'FUGA_GAS', lat: -33.5, lng: -70.7 }, null);
  });

  it('al cerrar la confirmación reinicia el tipo elegido', async () => {
    montar(conUbicacion);
    await userEvent.click(screen.getByRole('radio', { name: /Incendio/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Entendido' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.getByRole('radio', { name: /Incendio/ }).getAttribute('aria-checked')).toBe('false');
  });

  it('rechaza archivos que no son imágenes', async () => {
    const { onEnviar } = montar(conUbicacion);
    await userEvent.click(screen.getByRole('radio', { name: /Incendio/ }));
    const archivo = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Foto (opcional)'), archivo, { applyAccept: false });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    expect(screen.getByRole('alert').textContent).toContain('imagen');
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('muestra el error del servicio si el envío falla', async () => {
    montar(conUbicacion, vi.fn().mockRejectedValue(new Error('Sin conexión')));
    await userEvent.click(screen.getByRole('radio', { name: /Incendio/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Sin conexión');
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
