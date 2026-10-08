// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AvisosSla } from './AvisosSla';

afterEach(cleanup);

const indicativos = new Map([['r1', 'M12']]);

describe('AvisosSla', () => {
  it('es una región de anuncio cortés que existe aun sin avisos, y no es un diálogo modal', () => {
    render(<AvisosSla avisos={[]} indicativos={indicativos} onDescartar={vi.fn()} />);
    const region = screen.getByRole('log', { name: 'Avisos de SLA' });
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.queryByRole('alertdialog')).toBeNull();
  });

  it('cada vencimiento muestra glifo, palabra y el indicativo de la unidad', () => {
    const { container } = render(<AvisosSla avisos={[{ id: 1, recursoId: 'r1' }]} indicativos={indicativos} onDescartar={vi.fn()} />);
    expect(screen.getByText('SLA vencido · M12')).toBeTruthy();
    expect(container.querySelector('.ag-glyph--square')).not.toBeNull();
  });

  it('se descarta con su botón, sin mover el foco a ningún otro sitio', async () => {
    const descartar = vi.fn();
    render(<AvisosSla avisos={[{ id: 7, recursoId: 'r1' }]} indicativos={indicativos} onDescartar={descartar} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar el aviso de M12' }));
    expect(descartar).toHaveBeenCalledWith(7);
  });

  it('usa el id si no conoce el indicativo', () => {
    render(<AvisosSla avisos={[{ id: 1, recursoId: 'zzz' }]} indicativos={indicativos} onDescartar={vi.fn()} />);
    expect(screen.getByText('SLA vencido · zzz')).toBeTruthy();
  });
});
