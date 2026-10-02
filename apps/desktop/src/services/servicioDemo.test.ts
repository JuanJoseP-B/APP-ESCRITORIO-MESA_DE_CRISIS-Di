import { describe, expect, it, vi } from 'vitest';
import { crearServicioDemo } from './servicioDemo';

describe('servicioDemo (recursos)', () => {
  it('actualiza el recurso y notifica a los suscriptores', async () => {
    const servicio = crearServicioDemo();
    const alCambiar = vi.fn();
    const cancelar = servicio.suscribirRecursos(alCambiar);

    await servicio.cambiarEstadoRecurso('demo-rec-1', 'Despachado', 'demo-1');

    expect(alCambiar).toHaveBeenCalledWith(
      expect.objectContaining({
        tipo: 'UPDATE',
        nuevo: expect.objectContaining({ id: 'demo-rec-1', estado_actual: 'Despachado' }),
      }),
    );
    const recursos = await servicio.listarRecursos();
    expect(recursos.find((r) => r.id === 'demo-rec-1')?.incidente_asignado_id).toBe('demo-1');

    cancelar();
    await servicio.cambiarEstadoRecurso('demo-rec-1', 'Disponible', null);
    expect(alCambiar).toHaveBeenCalledTimes(1);
  });

  it('rechaza recursos inexistentes', async () => {
    await expect(crearServicioDemo().cambiarEstadoRecurso('nope', 'Disponible', null)).rejects.toThrow('nope');
  });
});
