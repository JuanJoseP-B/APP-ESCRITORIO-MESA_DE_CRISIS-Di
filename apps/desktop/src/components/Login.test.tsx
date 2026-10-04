// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Login } from './Login';

afterEach(cleanup);

describe('Login', () => {
  it('envía correo y contraseña', async () => {
    const onIniciarSesion = vi.fn().mockResolvedValue(undefined);
    render(<Login onIniciarSesion={onIniciarSesion} error={null} />);

    await userEvent.type(screen.getByLabelText('Correo'), 'op@x.com');
    await userEvent.type(screen.getByLabelText('Contraseña'), 'secreto');
    await userEvent.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => expect(onIniciarSesion).toHaveBeenCalledWith('op@x.com', 'secreto'));
  });

  it('muestra el error recibido', () => {
    render(<Login onIniciarSesion={vi.fn()} error="Credenciales inválidas" />);
    expect(screen.getByRole('alert').textContent).toBe('Credenciales inválidas');
  });
});
