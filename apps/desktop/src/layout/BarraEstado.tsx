import { Button, Glyph, type FormaGlifo } from '@argos/ui';
import type { EstadoEnlace } from '../domain/conexion';
import { etiquetaZonaHoraria, formatearHoraConSegundos } from '../domain/reloj';
import type { Tema } from '../tema';

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
  onFiltrarSla?: () => void;
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
  onFiltrarSla,
  onCerrarSesion,
}: BarraEstadoProps) {
  const estadoEnlace = ENLACE_UI[enlace];
  const nombreTurno = turno === 'carbon' ? 'Noche' : 'Día';
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
