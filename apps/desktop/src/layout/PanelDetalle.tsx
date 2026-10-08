import {
  ESTADOS_INCIDENTE,
  TRANSICIONES_RECURSO,
  type AnalisisPerimetro,
  type EstadoIncidente,
  type EstadoSla,
  type EstadoRecurso,
  type Incidente,
  type Recurso,
  type ZonaPublica,
} from '@argos/shared';
import { Badge, Button, DispatchRow, Kbd, SectionHeader, type VarianteBoton } from '@argos/ui';
import type { ObjetivoResaltado } from '../domain/analisisEspacial';
import { codigoIncidente, minutosAbierto } from '../domain/cola';
import type { AnilloGenerado } from '../domain/perimetro';
import { bitacora } from '../domain/timeline';
import {
  textoAccionRecurso,
  textoEstadoIncidente,
  textoEstadoRecurso,
  textoSeveridad,
  textoTipoRecurso,
} from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { indicativosDe } from '../domain/unidades';
import { PanelRefugios } from '../components/PanelRefugios';
import { formatearDuracion } from './ColaIncidentes';
import { CronometroUnidad } from './CronometroUnidad';
import { SeccionPerimetro } from './SeccionPerimetro';
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
  /** Anillos del incidente y su análisis espacial; sin ellos no se muestra la sección del perímetro. */
  perimetro?: { readonly anillos: readonly AnilloGenerado[]; readonly analisis: AnalisisPerimetro } | null;
  /** Al señalar un ítem del análisis (cursor o foco) el mapa lo resalta; `null` al soltarlo. */
  onResaltar?: (objetivo: ObjetivoResaltado | null) => void;
  /** Abre el despacho con el teclado (atajo D): unidad libre más cercana preseleccionada. */
  onAbrirDespacho?: () => void;
  /** SLA de las unidades con despacho en curso, por id de recurso; las asignadas llevan su cronómetro. */
  sla?: ReadonlyMap<string, EstadoSla>;
  /** Menos movimiento: el cronómetro vencido no parpadea y se marca con rayas. */
  reducirMovimiento?: boolean;
}

const SIN_SLA: ReadonlyMap<string, EstadoSla> = new Map();

/** Solo Despachar es la acción primaria (naranja); el resto es secundaria o neutra. */
const VARIANTE_ACCION: Record<EstadoRecurso, VarianteBoton> = {
  DISPONIBLE: 'ghost',
  ASIGNADO: 'primary',
  EN_RUTA: 'secondary',
  EN_ESCENA: 'secondary',
  INOPERATIVO: 'ghost',
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
  perimetro = null,
  onResaltar = () => undefined,
  onAbrirDespacho,
  sla = SIN_SLA,
  reducirMovimiento = false,
}: PanelDetalleProps) {
  const { t, idioma } = useTexto();
  const refugios = <PanelRefugios zonas={zonas} onCambiarOcupacion={onCambiarOcupacion} />;

  if (incidente === null) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-y-auto">
        <p className="px-4 py-4 font-mono text-data-sm text-text-muted">
          {t('detalle.vacio')}
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
        aria-label={t('detalle.accion.aria', { accion: textoAccionRecurso(t, destino), unidad: nombreUnidad(r) })}
        onClick={() => onCambiarEstadoRecurso(r, destino, incidente.id)}
      >
        {destino === 'ASIGNADO' ? t('detalle.despachar') : textoAccionRecurso(t, destino)}
      </Button>
    ));

  const fila = (r: Recurso) => (
    <li key={r.id}>
      <DispatchRow
        kind={textoTipoRecurso(t, r.tipo)}
        code={nombreUnidad(r)}
        status={ESTADO_RECURSO_UI[r.estado_actual]}
        statusLabel={textoEstadoRecurso(t, r.estado_actual)}
        timer={<CronometroUnidad sla={sla.get(r.id)} reducirMovimiento={reducirMovimiento} />}
        actions={accionesDe(r)}
      />
    </li>
  );

  const asignadas = recursos.filter((r) => r.incidente_asignado_id === incidente.id);
  const disponibles = recursos.filter((r) => r.estado_actual === 'DISPONIBLE');
  const inoperativas = recursos.filter((r) => r.estado_actual === 'INOPERATIVO');
  const entradas = bitacora(incidente.timeline, undefined, idioma);
  const totalEventos = entradas.filter((e) => e.tipo === 'evento').length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-y-auto">
      <section aria-label={t('detalle.ficha')} className="shrink-0">
        <SectionHeader index="01" title={t('detalle.titulo', { codigo: codigoIncidente(incidente.id) })} />
        <div className="px-4 pb-3">
          <h2 className="font-display text-title-sm text-text-primary">{incidente.titulo}</h2>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge severity={SEVERIDAD_UI[incidente.nivel_criticidad]}>{textoSeveridad(t, incidente.nivel_criticidad)}</Badge>
            <Badge status={ESTADO_INCIDENTE_UI[incidente.estado]}>{textoEstadoIncidente(t, incidente.estado)}</Badge>
            <span className="font-mono text-data-sm tabular text-text-secondary">
              {t('detalle.abierto', { duracion: formatearDuracion(minutosAbierto(incidente, ahora)) })}
            </span>
          </div>
          <div role="group" aria-label={t('detalle.estado')} className="mt-3 flex gap-1">
            {ESTADOS_INCIDENTE.filter((e) => e !== incidente.estado).map((e) => (
              <Button key={e} size="sm" onClick={() => onCambiarEstadoIncidente(incidente, e)}>
                {t('detalle.marcar', { estado: textoEstadoIncidente(t, e) })}
              </Button>
            ))}
          </div>
          {onAbrirDespacho && incidente.estado !== 'Resuelto' && (
            <Button size="sm" variant="secondary" className="mt-3" aria-keyshortcuts="D" onClick={onAbrirDespacho}>
              {t('detalle.despacharUnidad')} <Kbd>D</Kbd>
            </Button>
          )}
        </div>
      </section>

      {perimetro && (
        <SeccionPerimetro
          indice="02"
          anillos={perimetro.anillos}
          analisis={perimetro.analisis}
          zonas={zonas}
          recursos={recursos}
          indicativos={indicativos}
          onResaltar={onResaltar}
        />
      )}

      <section aria-label={t('detalle.asignadas')} className="shrink-0">
        <SectionHeader index={perimetro ? '03' : '02'} title={t('detalle.asignadas')} count={asignadas.length} />
        {asignadas.length === 0 ? (
          <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">{t('detalle.asignadas.vacio')}</p>
        ) : (
          <ul>{asignadas.map(fila)}</ul>
        )}
      </section>

      <section aria-label={t('detalle.disponibles.aria')} className="shrink-0">
        <SectionHeader index={perimetro ? '04' : '03'} title={t('detalle.disponibles')} count={disponibles.length} />
        {disponibles.length === 0 ? (
          <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">{t('detalle.disponibles.vacio')}</p>
        ) : (
          <ul>{disponibles.map(fila)}</ul>
        )}
        {inoperativas.length > 0 && (
          <>
            <p className="px-4 pt-2 font-mono text-overline uppercase text-text-muted">{t('detalle.fuera')}</p>
            <ul>{inoperativas.map(fila)}</ul>
          </>
        )}
      </section>

      <section aria-label={t('detalle.timeline')} className="shrink-0">
        <SectionHeader index={perimetro ? '05' : '04'} title={t('detalle.timeline')} count={totalEventos} />
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
                <span className="text-text-muted"> · {e.autor ?? t('detalle.sinAutor')}</span>
              </li>
            ),
          )}
        </ol>
      </section>

      <PanelRefugios zonas={zonas} onCambiarOcupacion={onCambiarOcupacion} indice={perimetro ? '06' : '05'} />
    </div>
  );
}
