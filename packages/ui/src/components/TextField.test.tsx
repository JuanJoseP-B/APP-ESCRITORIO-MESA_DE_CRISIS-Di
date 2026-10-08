// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TextField } from './TextField';

afterEach(cleanup);

describe('TextField', () => {
  it('asocia la etiqueta con el input', async () => {
    render(<TextField label="Correo" />);
    await userEvent.type(screen.getByLabelText('Correo'), 'op@x.com');
    expect((screen.getByLabelText('Correo') as HTMLInputElement).value).toBe('op@x.com');
  });

  it('muestra el error con role=alert, glifo y aria-invalid', () => {
    render(<TextField label="Correo" error="Credenciales inválidas" hint="ayuda" />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Credenciales inválidas');
    expect(alerta.querySelector('.ag-glyph--square')).not.toBeNull();
    const input = screen.getByLabelText('Correo');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(alerta.id);
    expect(screen.queryByText('ayuda')).toBeNull();
  });

  it('enlaza la ayuda cuando no hay error', () => {
    render(<TextField label="Código" hint="Sin espacios" />);
    const input = screen.getByLabelText('Código');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByText('Sin espacios').id);
  });
});
