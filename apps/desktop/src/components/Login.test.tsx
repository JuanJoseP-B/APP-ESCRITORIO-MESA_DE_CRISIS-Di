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

  it('el botón del ojo muestra y oculta la contraseña', async () => {
    render(<Login onIniciarSesion={vi.fn()} error={null} />);
    const campo = screen.getByLabelText('Contraseña');
    expect(campo.getAttribute('type')).toBe('password');
    await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
    expect(campo.getAttribute('type')).toBe('text');
    await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
    expect(campo.getAttribute('type')).toBe('password');
  });

  it('«Omitir intro» salta al cuadro final y deja el foco en el correo', async () => {
    const { container } = render(<Login onIniciarSesion={vi.fn()} error={null} />);
    await userEvent.click(screen.getByRole('button', { name: 'Omitir intro' }));
    expect(container.querySelector('.ag-login')?.getAttribute('data-intro')).toBe('omitida');
    expect(screen.queryByRole('button', { name: 'Omitir intro' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByLabelText('Correo'));
  });

  it('Esc también omite la intro', async () => {
    render(<Login onIniciarSesion={vi.fn()} error={null} />);
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('button', { name: 'Omitir intro' })).toBeNull();
  });

  it('el campo de contraseña se marca inválido y apunta al error', () => {
    render(<Login onIniciarSesion={vi.fn()} error="Credenciales inválidas" />);
    const campo = screen.getByLabelText('Contraseña');
    expect(campo.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(campo.getAttribute('aria-describedby') ?? '')?.textContent).toContain('Credenciales inválidas');
  });
});
