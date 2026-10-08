// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SelectField } from './SelectField';
import { TextAreaField } from './TextAreaField';

afterEach(cleanup);

const OPCIONES = [
  { value: '123', label: 'Línea 123' },
  { value: 'VHF', label: 'Radio VHF' },
];

describe('SelectField', () => {
  it('asocia la etiqueta con la lista y permite elegir una opción', async () => {
    const alCambiar = vi.fn();
    render(<SelectField label="Canal" options={OPCIONES} placeholder="Elige un canal" defaultValue="" onChange={alCambiar} />);
    const lista = screen.getByLabelText('Canal') as HTMLSelectElement;
    expect(lista.value).toBe('');
    expect(screen.getByRole('option', { name: 'Elige un canal' })).toBeTruthy();
    await userEvent.selectOptions(lista, 'VHF');
    expect(lista.value).toBe('VHF');
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('sin placeholder no hay opción vacía', () => {
    render(<SelectField label="Canal" options={OPCIONES} />);
    expect(screen.getAllByRole('option')).toHaveLength(2);
  });

  it('muestra el error con role=alert, glifo y aria-invalid', () => {
    render(<SelectField label="Canal" options={OPCIONES} error="Falta el canal" hint="ayuda" />);
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toBe('Falta el canal');
    expect(alerta.querySelector('.ag-glyph--square')).not.toBeNull();
    const lista = screen.getByLabelText('Canal');
    expect(lista.getAttribute('aria-invalid')).toBe('true');
    expect(lista.getAttribute('aria-describedby')).toBe(alerta.id);
    expect(screen.queryByText('ayuda')).toBeNull();
  });
});

describe('TextAreaField', () => {
  it('asocia la etiqueta con el área y guarda lo escrito', async () => {
    render(<TextAreaField label="Narrativa" />);
    await userEvent.type(screen.getByLabelText('Narrativa'), 'Olor a gas');
    expect((screen.getByLabelText('Narrativa') as HTMLTextAreaElement).value).toBe('Olor a gas');
  });

  it('enlaza la ayuda y, con error, la sustituye por la alerta', () => {
    const { rerender } = render(<TextAreaField label="Narrativa" hint="Qué se ve y qué se oye" />);
    expect(screen.getByLabelText('Narrativa').getAttribute('aria-describedby')).toBe(screen.getByText('Qué se ve y qué se oye').id);
    rerender(<TextAreaField label="Narrativa" hint="Qué se ve y qué se oye" error="Obligatoria" />);
    const alerta = screen.getByRole('alert');
    expect(screen.getByLabelText('Narrativa').getAttribute('aria-describedby')).toBe(alerta.id);
    expect(screen.getByLabelText('Narrativa').getAttribute('aria-invalid')).toBe('true');
  });
});
