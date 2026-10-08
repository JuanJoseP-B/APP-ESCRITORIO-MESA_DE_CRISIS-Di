// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TIPOS_EMERGENCIA } from '@argos/shared';
import { SelectorTipoEmergencia } from './SelectorTipoEmergencia';

afterEach(cleanup);

describe('SelectorTipoEmergencia', () => {
  it('ofrece una tarjeta por cada tipo del catálogo', () => {
    render(<SelectorTipoEmergencia valor={null} onCambiar={vi.fn()} />);
    expect(screen.getAllByRole('radio')).toHaveLength(TIPOS_EMERGENCIA.length);
  });

  it('marca solo la tarjeta seleccionada', () => {
    render(<SelectorTipoEmergencia valor="DESLIZAMIENTO" onCambiar={vi.fn()} />);
    const marcadas = screen.getAllByRole('radio').filter((r) => r.getAttribute('aria-checked') === 'true');
    expect(marcadas).toHaveLength(1);
    expect(marcadas[0]?.textContent).toContain('Deslizamiento');
  });

  it('notifica el tipo elegido', async () => {
    const onCambiar = vi.fn();
    render(<SelectorTipoEmergencia valor={null} onCambiar={onCambiar} />);
    await userEvent.click(screen.getByRole('radio', { name: /Inundación/ }));
    expect(onCambiar).toHaveBeenCalledWith('INUNDACION');
  });
});
