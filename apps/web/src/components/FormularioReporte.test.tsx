// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormularioReporte } from './FormularioReporte';
import type { EstadoGeolocalizacion } from '../hooks/useGeolocalizacion';

afterEach(cleanup);

const conUbicacion: EstadoGeolocalizacion = { estado: 'ok', coordenadas: { lat: -33.4, lng: -70.6 } };

function montar(geo: EstadoGeolocalizacion, onEnviar = vi.fn().mockResolvedValue(undefined)) {
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

  it('no envía sin ubicación y muestra el error', async () => {
    const { onEnviar } = montar({ estado: 'inactivo' });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect(screen.getByRole('alert').textContent).toContain('ubicación');
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('muestra el mensaje cuando la geolocalización falla', () => {
    montar({ estado: 'error', mensaje: 'Permiso de ubicación denegado.' });
    expect(screen.getByRole('alert').textContent).toContain('denegado');
  });

  it('envía tipo y coordenadas y confirma el envío', async () => {
    const { onEnviar } = montar(conUbicacion);
    await userEvent.selectOptions(screen.getByLabelText('Tipo de emergencia'), 'Creciente súbita');
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    expect(onEnviar).toHaveBeenCalledWith({ tipo: 'CRECIENTE_SUBITA', lat: -33.4, lng: -70.6 }, null);
    expect(await screen.findByRole('status')).toHaveProperty('textContent', expect.stringContaining('Reporte enviado'));
  });

  it('rechaza archivos que no son imágenes', async () => {
    const { onEnviar } = montar(conUbicacion);
    const archivo = new File(['x'], 'doc.pdf', { type: 'application/pdf' });
    await userEvent.upload(screen.getByLabelText('Foto (opcional)'), archivo, { applyAccept: false });
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));

    expect(screen.getByRole('alert').textContent).toContain('imagen');
    expect(onEnviar).not.toHaveBeenCalled();
  });

  it('muestra el error del servicio si el envío falla', async () => {
    montar(conUbicacion, vi.fn().mockRejectedValue(new Error('Sin conexión')));
    await userEvent.click(screen.getByRole('button', { name: 'Enviar reporte' }));
    expect((await screen.findByRole('alert')).textContent).toContain('Sin conexión');
  });
});
