import {
  ESTADOS_INCIDENTE,
  TRANSICIONES_RECURSO,
  type EstadoIncidente,
  type EstadoRecurso,
  type Incidente,
  type Recurso,
  type ZonaPublica,
} from '@argos/shared';
import { Badge, Button, DispatchRow, SectionHeader, type VarianteBoton } from '@argos/ui';
import { codigoIncidente, minutosAbierto } from '../domain/cola';
import { bitacora } from '../domain/timeline';
import { indicativosDe } from '../domain/unidades';
import { PanelRefugios } from '../components/PanelRefugios';
import { formatearDuracion } from './ColaIncidentes';
import { ESTADO_INCIDENTE_UI, ESTADO_RECURSO_UI, SEVERIDAD_UI } from './presentacion';

export interface PanelDetalleProps {
  /** Incidente seleccionado; sin él no hay ficha ni se puede despachar. */
  incidente: Incidente | null;
  recursos: readonly Recurso[];
  zonas: readonly ZonaPublica[];
  /** Hora corregida (ms epoch) para el tiempo abierto. */
  ahora: number;
  onCambiarEstadoIncidente: (incidente: Incidente, estado: EstadoIncidente) => void;
  /** Mutación de la unidad; al despachar recibe el `incidenteId` del incidente mostrado. */
  onCambiarEstadoRecurso: (recurso: Recurso, estado: EstadoRecurso, incidenteId: string) => void;
  onCambiarOcupacion: (zona: ZonaPublica, delta: number) => void;
}

const ETIQUETA_ACCION: Record<EstadoRecurso, string> = {
  Disponible: 'Liberar',
  Despachado: 'Despachar',
  'En Escena': 'En escena',
  Inoperativo: 'Inoperativo',
};

/** Solo Despachar es la acción primaria (naranja); el resto es secundaria o neutra. */
const VARIANTE_ACCION: Record<EstadoRecurso, VarianteBoton> = {
  Disponible: 'ghost',
  Despachado: 'primary',
  'En Escena': 'secondary',
  Inoperativo: 'ghost',
};

/** D · detalle del incidente: ficha, unidades (aquí vive DESPACHAR), línea de tiempo y refugios. */
export function PanelDetalle({
  incidente,
  recursos,
  zonas,
  ahora,
  onCambiarEstadoIncidente,
  onCambiarEstadoRecurso,
  onCambiarOcupacion,
}: PanelDetalleProps) {
  const refugios = <PanelRefugios zonas={zonas} onCambiarOcupacion={onCambiarOcupacion} />;

  if (incidente === null) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <p className="px-4 py-4 font-mono text-data-sm text-text-muted">
          Selecciona un incidente en la cola para ver su ficha y despachar unidades.
        </p>
        {refugios}
      </div>
    );
  }

  // Indicativo completo ("B-02", "M11"): el id de base de datos no sirve para dictar por radio.
  const indicativos = indicativosDe(recursos);
  const nombreUnidad = (r: Recurso): string => indicativos.get(r.id) ?? r.id;

  const accionesDe = (r: Recurso) =>
    TRANSICIONES_RECURSO[r.estado_actual].map((destino) => (
      <Button
        key={destino}
        size="sm"
        variant={VARIANTE_ACCION[destino]}
        aria-label={`${ETIQUETA_ACCION[destino]} ${nombreUnidad(r)}`}
        onClick={() => onCambiarEstadoRecurso(r, destino, incidente.id)}
      >
        {destino === 'Despachado' ? 'DESPACHAR' : ETIQUETA_ACCION[destino]}
      </Button>
    ));

  const fila = (r: Recurso) => (
    <li key={r.id}>
      <DispatchRow
        kind={r.tipo}
        code={nombreUnidad(r)}
        status={ESTADO_RECURSO_UI[r.estado_actual]}
        actions={accionesDe(r)}
      />
    </li>
  );

  const asignadas = recursos.filter((r) => r.incidente_asignado_id === incidente.id);
  const disponibles = recursos.filter((r) => r.estado_actual === 'Disponible');
  const inoperativas = recursos.filter((r) => r.estado_actual === 'Inoperativo');
  const entradas = bitacora(incidente.timeline);
  const totalEventos = entradas.filter((e) => e.tipo === 'evento').length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <section aria-label="Ficha del incidente" className="shrink-0">
        <SectionHeader index="01" title={`Incidente #${codigoIncidente(incidente.id)}`} />
        <div className="px-4 pb-3">
          <h2 className="font-display text-title-sm text-text-primary">{incidente.titulo}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge severity={SEVERIDAD_UI[incidente.nivel_criticidad]} />
            <Badge status={ESTADO_INCIDENTE_UI[incidente.estado]} />
            <span className="font-mono text-data-sm tabular text-text-secondary">
              Abierto hace {formatearDuracion(minutosAbierto(incidente, ahora))}
            </span>
          </div>
          <div role="group" aria-label="Estado del incidente" className="mt-3 flex gap-1">
            {ESTADOS_INCIDENTE.filter((e) => e !== incidente.estado).map((e) => (
              <Button key={e} size="sm" onClick={() => onCambiarEstadoIncidente(incidente, e)}>
                Marcar {e}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <section aria-label="Unidades asignadas" className="shrink-0">
        <SectionHeader index="02" title="Unidades asignadas" count={asignadas.length} />
        {asignadas.length === 0 ? (
          <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">Sin unidades asignadas</p>
        ) : (
          <ul>{asignadas.map(fila)}</ul>
        )}
      </section>

      <section aria-label="Unidades disponibles" className="shrink-0">
        <SectionHeader index="03" title="Disponibles para despachar" count={disponibles.length} />
        {disponibles.length === 0 ? (
          <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">No hay unidades disponibles</p>
        ) : (
          <ul>{disponibles.map(fila)}</ul>
        )}
        {inoperativas.length > 0 && (
          <>
            <p className="px-4 pt-2 font-mono text-overline uppercase text-text-muted">Fuera de servicio</p>
            <ul>{inoperativas.map(fila)}</ul>
          </>
        )}
      </section>

      <section aria-label="Línea de tiempo" className="shrink-0">
        <SectionHeader index="04" title="Línea de tiempo" count={totalEventos} />
        <ol className="px-4 pb-3 font-mono text-data-sm text-text-secondary">
          {entradas.map((e, n) =>
            e.tipo === 'fecha' ? (
              <li key={`fecha-${e.clave}`} className="mt-2 border-t border-border-subtle pt-2 text-overline uppercase text-text-muted first:mt-0 first:border-t-0 first:pt-0">
                <time dateTime={e.clave}>{e.etiqueta}</time>
              </li>
            ) : (
              <li key={`${n}-${e.descripcion}`} className="py-0.5">
                <time dateTime={e.iso ?? undefined} className="mr-2 font-bold tabular text-text-primary">
                  {e.hora}
                </time>
                {e.descripcion}
                <span className="text-text-muted"> · {e.autor ?? 'sin autor'}</span>
              </li>
            ),
          )}
        </ol>
      </section>

      {refugios}
    </div>
  );
}
