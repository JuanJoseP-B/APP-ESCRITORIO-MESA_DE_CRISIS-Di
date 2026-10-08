import { Settings } from 'lucide-react';
import { Button, Glyph, type FormaGlifo } from '@argos/ui';
import type { EstadoEnlace } from '../domain/conexion';
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
  /** Unidades con SLA vencido; si falta, el contador no se muestra (llega con la lógica CAD). */
  slaVencidos?: number;
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
  slaVencidos,
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
    <header aria-label={t('barra.aria')} className="flex h-full items-center gap-4 px-4 text-text-primary">
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
      {slaVencidos !== undefined && (
        <Button
          size="sm"
          variant="ghost"
          aria-label={t('barra.sla.aria', { n: slaVencidos })}
          disabled={slaVencidos === 0}
          onClick={onFiltrarSla}
          className={slaVencidos > 0 ? 'text-status-critical' : undefined}
        >
          <Glyph shape="square" /> <span className="tabular">{slaVencidos}</span> SLA
        </Button>
      )}
      {simulacion && (
        <div role="group" aria-label={t('barra.sim.aria')} className="flex items-center gap-2">
          <span className="font-mono text-overline uppercase text-text-secondary">{t('barra.sim')}</span>
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
          <Button size="sm" variant="ghost" onClick={simulacion.onReiniciar}>
            {t('barra.sim.reiniciar')}
          </Button>
        </div>
      )}
      <span className="ml-auto flex items-center gap-2">
        {onAbrirAjustes && (
          <Button
            size="sm"
            variant="ghost"
            square
            aria-label={t('barra.ajustes')}
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
