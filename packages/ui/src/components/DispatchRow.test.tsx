// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DispatchRow } from './DispatchRow';

afterEach(cleanup);

describe('DispatchRow', () => {
  it('disponible ofrece Despachar (primario) e Inoperativo', async () => {
    const onDispatch = vi.fn();
    const onToggleOperative = vi.fn();
    render(<DispatchRow kind="Ambulancia" code="U02" status="disponible" onDispatch={onDispatch} onToggleOperative={onToggleOperative} />);
    const despachar = screen.getByRole('button', { name: 'Despachar' });
    expect(despachar.classList.contains('ag-btn--primary')).toBe(true);
    await userEvent.click(despachar);
    await userEvent.click(screen.getByRole('button', { name: 'Inoperativo' }));
    expect(onDispatch).toHaveBeenCalledTimes(1);
    expect(onToggleOperative).toHaveBeenCalledTimes(1);
  });

  it('despachado ofrece En ruta y Cancelar (no salta directo a En escena)', async () => {
    const onEnRoute = vi.fn();
    const onCancel = vi.fn();
    render(<DispatchRow kind="Bomberos" code="M11" status="despachado" onEnRoute={onEnRoute} onCancel={onCancel} />);
    expect(screen.queryByRole('button', { name: 'En escena' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'En ruta' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onEnRoute).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('en ruta ofrece En escena y Cancelar', async () => {
    const onArrive = vi.fn();
    const onCancel = vi.fn();
    render(<DispatchRow kind="Ambulancia" code="M12" status="enruta" onArrive={onArrive} onCancel={onCancel} />);
    expect(screen.getByText('En ruta')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: 'En escena' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(onArrive).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('en escena ofrece Liberar; inoperativo ofrece Habilitar', async () => {
    const onRelease = vi.fn();
    const onToggleOperative = vi.fn();
    const { rerender } = render(<DispatchRow kind="Policía" code="P01" status="escena" onRelease={onRelease} />);
    await userEvent.click(screen.getByRole('button', { name: 'Liberar' }));
    expect(onRelease).toHaveBeenCalledTimes(1);
    rerender(<DispatchRow kind="Policía" code="P01" status="inoperativo" onToggleOperative={onToggleOperative} />);
    await userEvent.click(screen.getByRole('button', { name: 'Habilitar' }));
    expect(onToggleOperative).toHaveBeenCalledTimes(1);
  });

  it('expone el grupo con nombre accesible y el estado en palabra para lectores', () => {
    render(<DispatchRow kind="Ambulancia" code="U02" status="escena" detail="Av. Central" />);
    expect(screen.getByRole('group', { name: 'Ambulancia U02' })).toBeTruthy();
    expect(screen.getByText('En escena')).toBeTruthy();
    expect(screen.getByText('Av. Central')).toBeTruthy();
  });
});
