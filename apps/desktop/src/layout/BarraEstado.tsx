import { Settings } from 'lucide-react';
import { Button, Glyph, SegmentedControl, type FormaGlifo } from '@argos/ui';
import type { EstadoEnlace } from '../domain/conexion';
import { IDS_ESCENARIO, type IdEscenario } from '../domain/escenario';
import { useTexto } from '../i18n/IdiomaProvider';
import { etiquetaZonaHoraria, formatearHoraConSegundos, formatearMinSeg } from '../domain/reloj';
import { VELOCIDADES, type Velocidad } from '../domain/relojSimulado';
import type { Tema } from '../tema';

/** Control del escenario del demo; la barra lo muestra solo si se le pasa (modo demo). */
export interface SimulacionBarra {
  reproduciendo: boolean;
  velocidad: Velocidad;
  /** Segundos del escenario transcurridos. */
  tSeg: number;
  duracionSeg: number;
  onAlternar: () => void;
  onVelocidad: (velocidad: Velocidad) => void;
  onReiniciar: () => void;
  /** Escenario activo y cómo cambiarlo; el selector solo se ofrece antes de iniciar (t = 0). */
  escenario?: { actual: IdEscenario; onElegir: (id: IdEscenario) => void };
}

export interface BarraEstadoProps {
  /** Hora corregida (ms epoch), p. ej. de `useReloj`. */
  hora: number;
  /** Zona IANA; por defecto la del sistema. */
  zona?: string;
  /** Tema que se pinta: de él sale el turno (crema = día, carbón = noche). */
  turno: Tema;
  operador: string;
  enlace: EstadoEnlace;
  /** Unidades en ALERTA o VENCIDO; el contador solo se muestra si es mayor que 0. */
  slaEnRiesgo?: number;
  /** Nivel más grave entre ellas: da el color y el glifo del contador. */
  slaNivel?: 'ALERTA' | 'VENCIDO';
  /** La cola está filtrada por SLA. */
  filtroSlaActivo?: boolean;
  /** Llamadas sin vincular en la bandeja de entrantes. */
  entrantes?: number;
  onFiltrarSla?: () => void;
  simulacion?: SimulacionBarra;
  onCerrarSesion?: () => void;
  onAbrirAjustes?: () => void;
}

const ENLACE_UI: Record<EstadoEnlace, { shape: FormaGlifo; clase: string }> = {
  EN_VIVO: { shape: 'circle', clase: 'text-status-success' },
  CONECTANDO: { shape: 'diamond', clase: 'text-status-info' },
  SIN_ENLACE: { shape: 'square', clase: 'text-status-critical' },
};

/** A · barra de estado: reloj con segundos, turno, operador y estado del enlace Realtime. */
export function BarraEstado({
  hora,
  zona,
  turno,
  operador,
  enlace,
  slaEnRiesgo = 0,
  slaNivel = 'ALERTA',
  filtroSlaActivo = false,
  entrantes,
  onFiltrarSla,
  simulacion,
  onCerrarSesion,
  onAbrirAjustes,
}: BarraEstadoProps) {
  const { t, idioma } = useTexto();
  const estadoEnlace = ENLACE_UI[enlace];
  const palabraEnlace = t(`enlace.${enlace}`);
  const nombreTurno = turno === 'carbon' ? t('barra.turno.noche') : t('barra.turno.dia');
  /** Mientras t=0 y en pausa, el escenario aún no ha empezado. */
  const sinIniciar = simulacion !== undefined && !simulacion.reproduciendo && simulacion.tSeg === 0;
  return (
    <header aria-label={t('barra.aria')} className="flex h-full items-center gap-4 whitespace-nowrap px-4 text-text-primary">
      <span className="font-mono text-overline uppercase text-text-primary">
        <span aria-hidden="true">■ </span>ARGOS
      </span>
      <span className="flex items-baseline gap-2">
        <time dateTime={new Date(hora).toISOString()} className="font-mono text-data-md tabular">
          {formatearHoraConSegundos(hora, zona, idioma)}
        </time>
        <span className="font-mono text-data-sm text-text-muted">{etiquetaZonaHoraria(hora, zona)}</span>
      </span>
      <span className="font-mono text-data-sm uppercase text-text-secondary">
        {t('barra.turno', { turno: nombreTurno })}
        {operador ? <span className="text-text-muted"> · {operador}</span> : null}
      </span>
      <span role="status" aria-label={t('barra.enlace.aria', { estado: palabraEnlace })} className={`flex items-center gap-2 font-mono text-data-sm uppercase ${estadoEnlace.clase}`}>
        <Glyph shape={estadoEnlace.shape} />
        {palabraEnlace}
      </span>
      {entrantes !== undefined && (
        <span
          role="status"
          aria-label={t('barra.entrantes.aria', { n: entrantes })}
          className={`flex items-center gap-2 font-mono text-data-sm uppercase ${entrantes > 0 ? 'text-status-warning' : 'text-text-muted'}`}
        >
          <Glyph shape={entrantes > 0 ? 'triangle' : 'ring'} />
          <span className="tabular">{entrantes}</span> {t('barra.entrantes')}
        </span>
      )}
      {slaEnRiesgo > 0 && (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t('barra.sla.aria', { n: slaEnRiesgo, nivel: slaNivel === 'VENCIDO' ? t('sla.vencido') : t('sla.alerta') })}
          aria-pressed={filtroSlaActivo}
          onClick={onFiltrarSla}
          className={slaNivel === 'VENCIDO' ? 'text-status-critical' : 'text-status-warning'}
        >
          <Glyph shape={slaNivel === 'VENCIDO' ? 'square' : 'triangle'} /> <span className="tabular">{slaEnRiesgo}</span> SLA
        </Button>
      )}
      {simulacion && (
        <div role="group" aria-label={t('barra.sim.aria')} className="flex items-center gap-2">
          {sinIniciar && simulacion.escenario ? (
            <span className="flex items-center gap-2" title={t(`escenario.${simulacion.escenario.actual}.desc`)}>
              <SegmentedControl
                label={t('escenario.aria')}
                options={IDS_ESCENARIO.map((id) => ({ value: id, label: id }))}
                value={simulacion.escenario.actual}
                onChange={simulacion.escenario.onElegir}
              />
              <span className="font-ui text-body-sm text-text-primary">{t(`escenario.${simulacion.escenario.actual}.titulo`)}</span>
            </span>
          ) : (
            <span className="font-mono text-overline uppercase text-text-secondary">{t('barra.sim')}</span>
          )}
          <span className="font-mono text-data-sm tabular text-text-primary">
            {formatearMinSeg(simulacion.tSeg)} / {formatearMinSeg(simulacion.duracionSeg)}
          </span>
          {sinIniciar ? (
            <Button size="sm" variant="primary" onClick={simulacion.onAlternar}>
              <Glyph shape="triangle" /> {t('barra.sim.iniciar')}
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={simulacion.onAlternar}>
              <Glyph shape={simulacion.reproduciendo ? 'square' : 'triangle'} /> {simulacion.reproduciendo ? t('barra.sim.pausar') : t('barra.sim.reproducir')}
            </Button>
          )}
          <span role="group" aria-label={t('barra.sim.velocidad')} className="flex items-center gap-1">
            {VELOCIDADES.map((v) => (
              <Button
                key={v}
                size="sm"
                variant={v === simulacion.velocidad ? 'secondary' : 'ghost'}
                aria-pressed={v === simulacion.velocidad}
                aria-label={t('barra.sim.velocidad.aria', { v })}
                onClick={() => simulacion.onVelocidad(v)}
              >
                <span className="tabular">{v}×</span>
              </Button>
            ))}
          </span>
          {!sinIniciar && (
            <Button size="sm" variant="ghost" onClick={simulacion.onReiniciar}>
              {t('barra.sim.reiniciar')}
            </Button>
          )}
        </div>
      )}
      <span className="ml-auto flex items-center gap-2">
        {onAbrirAjustes && (
          <Button
            size="sm"
            variant="ghost"
            square
            aria-label={t('barra.ajustes')} data-tutorial="ajustes"
            aria-haspopup="dialog"
            title={t('barra.ajustes')}
            onClick={onAbrirAjustes}
          >
            <Settings aria-hidden="true" size={16} />
          </Button>
        )}
        {onCerrarSesion && (
          <Button size="sm" variant="ghost" onClick={onCerrarSesion}>
            {t('barra.salir')}
          </Button>
        )}
      </span>
    </header>
  );
}
