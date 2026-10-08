// @vitest-environment jsdom
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RecomendacionAsesor, SnapshotAsesor } from '@argos/shared';
import type { EstadoAsesor } from '../hooks/useAsesor';
import { IdiomaProvider } from '../i18n/IdiomaProvider';
import { TarjetaAsesor, type TarjetaAsesorProps } from './TarjetaAsesor';
import css from './TarjetaAsesor.css?raw';

afterEach(cleanup);

const snapshot: SnapshotAsesor = {
  version: 1,
  generadoEn: '2026-10-07T12:00:00.000Z',
  incidente: {
    id: 'inc-1',
    codigo: 'IN1',
    tipo: 'FUGA_GAS',
    prioridad: 'P1',
    ubicacion: { lat: 1.2, lng: -77.2 },
    descripcion: 'Fuga',
    llamadasVinculadas: 1,
    minutosAbierto: 3,
    perimetroActual: null,
  },
  recursos: [
    { id: 'u01', indicativo: 'U01', tipo: 'Bomberos', estado: 'DISPONIBLE', incidenteId: null, ubicacion: { lat: 1.2, lng: -77.2 }, distanciaM: 640 },
    { id: 'm11', indicativo: 'M11', tipo: 'Ambulancia', estado: 'DISPONIBLE', incidenteId: null, ubicacion: { lat: 1.2, lng: -77.2 }, distanciaM: 1300 },
  ],
  refugios: [{ id: 'z1', nombre: 'Colegio Central', ubicacion: { lat: 1.2, lng: -77.2 }, ocupacion: 20, capacidad: 120, anillo: 'FUERA' }],
  contexto: { slaVencidos: [], unidadesEnZonaCaliente: [] },
};

const recomendacion: RecomendacionAsesor = {
  idRecomendacion: 'rec-1',
  unidades: [
    { idRecurso: 'u01', rol: 'Control y rescate', etaMin: 1 },
    { idRecurso: 'm11', rol: 'Atención prehospitalaria', etaMin: 2 },
  ],
  justificacion: 'Fuga de gas P1, abierto hace 3 min.',
  perimetroSugerido: { CALIENTE: 100, TIBIA: 300, EVACUACION: 800 },
  refugioSugeridoId: 'z1',
  advertencias: ['SLA vencido en P07.'],
  confianza: 'MEDIA',
};

const listo: EstadoAsesor = { fase: 'listo', snapshot, recomendacion };

const montar = (props: Partial<TarjetaAsesorProps> & { estado: EstadoAsesor }, idioma: 'es' | 'en' = 'es') => {
  const acciones = { onAplicar: vi.fn(), onDescartar: vi.fn(), onCerrar: vi.fn() };
  render(
    <IdiomaProvider inicial={idioma}>
      <TarjetaAsesor {...acciones} {...props} />
    </IdiomaProvider>,
  );
  return acciones;
};

describe('TarjetaAsesor', () => {
  it('cerrada no pinta nada', () => {
    montar({ estado: { fase: 'inactivo' } });
    expect(screen.queryByRole('region')).toBeNull();
  });

  it('se identifica como asesor de motor de reglas', () => {
    montar({ estado: listo });
    expect(screen.getByRole('region', { name: 'Asesor táctico · motor de reglas' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Asesor táctico · motor de reglas' })).toBeTruthy();
  });

  it('analizando: avisa con un estado accesible y un esqueleto animado', () => {
    montar({ estado: { fase: 'analizando' } });
    expect(screen.getByRole('status').textContent).toContain('Analizando el incidente…');
    expect(screen.getByRole('region').getAttribute('aria-busy')).toBe('true');
    const barras = document.querySelectorAll('.ag-esqueleto');
    expect(barras).toHaveLength(3);
    expect(document.querySelectorAll('.ag-esqueleto--quieto')).toHaveLength(0);
  });

  it('con movimiento reducido el esqueleto no se anima', () => {
    montar({ estado: { fase: 'analizando' }, reducirMovimiento: true });
    expect(document.querySelectorAll('.ag-esqueleto--quieto')).toHaveLength(3);
    expect(css).toMatch(/\.ag-esqueleto--quieto \{ animation: none; \}/);
    expect(css).toContain('prefers-reduced-motion: reduce');
    expect(css).toContain("data-reduced-motion='true'");
  });

  it('el CSS usa solo tokens: sin colores sueltos, degradados ni opacidad', () => {
    expect(css).not.toMatch(/#[0-9a-f]{3,8}\b|rgba?\(|hsla?\(/i);
    expect(css).not.toMatch(/gradient|opacity|backdrop/);
  });

  it('resultado: unidades con rol, ETA y distancia', () => {
    montar({ estado: listo });
    const unidades = screen.getByRole('list', { name: 'Unidades recomendadas' });
    const [primera, segunda] = within(unidades).getAllByRole('listitem');
    expect(primera?.textContent).toContain('U01');
    expect(primera?.textContent).toContain('Bomberos · Control y rescate');
    expect(primera?.textContent).toContain('ETA 1 min · 640 m');
    expect(segunda?.textContent).toContain('M11');
    expect(segunda?.textContent).toContain('ETA 2 min · 1,3 km');
  });

  it('resultado: justificación, perímetro, refugio, advertencias y confianza con palabra y glifo', () => {
    montar({ estado: listo });
    expect(screen.getByText('Fuga de gas P1, abierto hace 3 min.')).toBeTruthy();
    expect(screen.getByText('100 / 300 / 800 m')).toBeTruthy();
    expect(screen.getByText('Colegio Central · cupo libre 100')).toBeTruthy();
    expect(within(screen.getByRole('list', { name: 'Advertencias' })).getByText('SLA vencido en P07.')).toBeTruthy();
    expect(screen.getByText('Media')).toBeTruthy();
    expect(screen.getByText('Confianza')).toBeTruthy();
  });

  it('sin unidades, sin refugio y sin advertencias lo dice y omite la lista de advertencias', () => {
    montar({ estado: { fase: 'listo', snapshot, recomendacion: { ...recomendacion, unidades: [], refugioSugeridoId: null, advertencias: [] } } });
    expect(screen.getByText('Sin unidades que despachar.')).toBeTruthy();
    expect(screen.getByText('Sin refugio sugerido')).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Advertencias' })).toBeNull();
  });

  it('[APLICAR SUGERENCIA], [DESCARTAR] y [CERRAR] llaman a su acción', async () => {
    const { onAplicar, onDescartar, onCerrar } = montar({ estado: listo });
    await userEvent.click(screen.getByRole('button', { name: 'APLICAR SUGERENCIA' }));
    await userEvent.click(screen.getByRole('button', { name: 'DESCARTAR' }));
    await userEvent.click(screen.getByRole('button', { name: /^CERRAR/ }));
    expect(onAplicar).toHaveBeenCalledTimes(1);
    expect(onDescartar).toHaveBeenCalledTimes(1);
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('sin manejadores de aplicar y descartar no se ofrecen', () => {
    montar({ estado: listo, onAplicar: undefined, onDescartar: undefined });
    expect(screen.queryByRole('button', { name: 'APLICAR SUGERENCIA' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'DESCARTAR' })).toBeNull();
  });

  it('error: mensaje claro, el despacho manual sigue disponible y no hay nada que aplicar', async () => {
    const { onCerrar } = montar({ estado: { fase: 'error', error: 'SIN_RECOMENDACION', detalle: 'detalle interno' } });
    const alerta = screen.getByRole('alert');
    expect(alerta.textContent).toContain('El asesor no pudo recomendar');
    expect(alerta.textContent).toContain('No hay una recomendación posible para este incidente.');
    expect(screen.getByText(/El despacho manual sigue disponible/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'APLICAR SUGERENCIA' })).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: /^CERRAR/ }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('error técnico: muestra también el detalle', () => {
    montar({ estado: { fase: 'error', error: 'RESPUESTA_INVALIDA', detalle: 'RECURSO_INEXISTENTE: x' } });
    expect(screen.getByRole('alert').textContent).toContain('RECURSO_INEXISTENTE: x');
  });

  it('en inglés traduce la tarjeta', () => {
    montar({ estado: listo }, 'en');
    expect(screen.getByRole('region', { name: 'Tactical advisor · rules engine' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'APPLY SUGGESTION' })).toBeTruthy();
    expect(screen.getByText('Medium')).toBeTruthy();
    expect(screen.getByText('Colegio Central · free capacity 100')).toBeTruthy();
  });
});
