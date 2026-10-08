import { Button, Glyph, type FormaGlifo } from '@argos/ui';
import type { EstadoEnlace } from '../domain/conexion';
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
  turno: Tema;
  onAlternarTurno: () => void;
  operador: string;
  enlace: EstadoEnlace;
  /** Unidades con SLA vencido; si falta, el contador no se muestra (llega con la lógica CAD). */
  slaVencidos?: number;
  /** Llamadas sin vincular en la bandeja de entrantes. */
  entrantes?: number;
  onFiltrarSla?: () => void;
  simulacion?: SimulacionBarra;
  onCerrarSesion?: () => void;
}

const ENLACE_UI: Record<EstadoEnlace, { palabra: string; shape: FormaGlifo; clase: string }> = {
  EN_VIVO: { palabra: 'En vivo', shape: 'circle', clase: 'text-status-success' },
  CONECTANDO: { palabra: 'Conectando', shape: 'diamond', clase: 'text-status-info' },
  SIN_ENLACE: { palabra: 'Sin enlace', shape: 'square', clase: 'text-status-critical' },
};

/** A · barra de estado: reloj con segundos, turno, operador y estado del enlace Realtime. */
export function BarraEstado({
  hora,
  zona,
  turno,
  onAlternarTurno,
  operador,
  enlace,
  slaVencidos,
  entrantes,
  onFiltrarSla,
  simulacion,
  onCerrarSesion,
}: BarraEstadoProps) {
  const estadoEnlace = ENLACE_UI[enlace];
  const nombreTurno = turno === 'carbon' ? 'Noche' : 'Día';
  /** Mientras t=0 y en pausa, el escenario aún no ha empezado. */
  const sinIniciar = simulacion !== undefined && !simulacion.reproduciendo && simulacion.tSeg === 0;
  return (
    <header aria-label="Barra de estado" className="flex h-full items-center gap-4 px-4 text-text-primary">
      <span className="font-mono text-overline uppercase text-text-primary">
        <span aria-hidden="true">■ </span>ARGOS
      </span>
      <span className="flex items-baseline gap-2">
        <time dateTime={new Date(hora).toISOString()} className="font-mono text-data-md tabular">
          {formatearHoraConSegundos(hora, zona)}
        </time>
        <span className="font-mono text-data-sm text-text-muted">{etiquetaZonaHoraria(hora, zona)}</span>
      </span>
      <span className="font-mono text-data-sm uppercase text-text-secondary">
        Turno {nombreTurno}
        {operador ? <span className="text-text-muted"> · {operador}</span> : null}
      </span>
      <span role="status" aria-label={`Enlace: ${estadoEnlace.palabra}`} className={`flex items-center gap-2 font-mono text-data-sm uppercase ${estadoEnlace.clase}`}>
        <Glyph shape={estadoEnlace.shape} />
        {estadoEnlace.palabra}
      </span>
      {entrantes !== undefined && (
        <span
          role="status"
          aria-label={`${entrantes} llamadas entrantes`}
          className={`flex items-center gap-2 font-mono text-data-sm uppercase ${entrantes > 0 ? 'text-status-warning' : 'text-text-muted'}`}
        >
          <Glyph shape={entrantes > 0 ? 'triangle' : 'ring'} />
          <span className="tabular">{entrantes}</span> Entrantes
        </span>
      )}
      {slaVencidos !== undefined && (
        <Button
          size="sm"
          variant="ghost"
          aria-label={`Filtrar cola: ${slaVencidos} SLA vencidos`}
          disabled={slaVencidos === 0}
          onClick={onFiltrarSla}
          className={slaVencidos > 0 ? 'text-status-critical' : undefined}
        >
          <Glyph shape="square" /> <span className="tabular">{slaVencidos}</span> SLA
        </Button>
      )}
      {simulacion && (
        <div role="group" aria-label="Simulación del escenario" className="flex items-center gap-2">
          <span className="font-mono text-overline uppercase text-text-secondary">Sim</span>
          <span className="font-mono text-data-sm tabular text-text-primary">
            {formatearMinSeg(simulacion.tSeg)} / {formatearMinSeg(simulacion.duracionSeg)}
          </span>
          {sinIniciar ? (
            <Button size="sm" variant="primary" onClick={simulacion.onAlternar}>
              <Glyph shape="triangle" /> Iniciar escenario
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={simulacion.onAlternar}>
              <Glyph shape={simulacion.reproduciendo ? 'square' : 'triangle'} /> {simulacion.reproduciendo ? 'Pausar' : 'Reproducir'}
            </Button>
          )}
          <span role="group" aria-label="Velocidad" className="flex items-center gap-1">
            {VELOCIDADES.map((v) => (
              <Button
                key={v}
                size="sm"
                variant={v === simulacion.velocidad ? 'secondary' : 'ghost'}
                aria-pressed={v === simulacion.velocidad}
                aria-label={`Velocidad ${v}×`}
                onClick={() => simulacion.onVelocidad(v)}
              >
                <span className="tabular">{v}×</span>
              </Button>
            ))}
          </span>
          <Button size="sm" variant="ghost" onClick={simulacion.onReiniciar}>
            Reiniciar
          </Button>
        </div>
      )}
      <span className="ml-auto flex items-center gap-2">
        <Button size="sm" variant="ghost" onClick={onAlternarTurno}>
          {turno === 'carbon' ? 'Turno día' : 'Turno noche'}
        </Button>
        {onCerrarSesion && (
          <Button size="sm" variant="ghost" onClick={onCerrarSesion}>
            Salir
          </Button>
        )}
      </span>
    </header>
  );
}
