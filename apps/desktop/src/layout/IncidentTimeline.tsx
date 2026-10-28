import { useEffect, useRef, useState } from 'react';
import type { EventoRecurso, Incidente, Llamada, Recurso } from '@argos/shared';
import { hitosDeIncidente, type HitoIncidente } from '../domain/hitos';
import type { EtaUnidad } from '../domain/movimiento';
import { formatearMinSeg } from '../domain/reloj';
import { formatearHora } from '../domain/timeline';
import { textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import './IncidentTimeline.css';

export interface IncidentTimelineProps {
  readonly incidente: Incidente;
  readonly llamadas: readonly Llamada[];
  readonly eventos: readonly EventoRecurso[];
  readonly recursos: readonly Recurso[];
  /** Indicativo de cada unidad por id ("U01"). */
  readonly indicativos: ReadonlyMap<string, string>;
  /** Avance y tiempo restante de las unidades en ruta, por id de recurso. */
  readonly etas?: ReadonlyMap<string, EtaUnidad>;
}

const SIN_ETAS: ReadonlyMap<string, EtaUnidad> = new Map();

/**
 * Línea de tiempo del incidente: Llamada → Creado → Despachada → En ruta → En escena → Contenido → Resuelto. Los
 * hitos hechos llevan nodo carbón; el actual, la etiqueta AHORA y un nodo naranja que late (en ruta, con la barra de
 * ETA); los pendientes van atenuados en una sola línea. Un hito que llega aparece escalando y su línea se rellena.
 */
export function IncidentTimeline({ incidente, llamadas, eventos, recursos, indicativos, etas = SIN_ETAS }: IncidentTimelineProps) {
  const { t, idioma } = useTexto();
  const hitos = hitosDeIncidente(incidente, llamadas, eventos);
  const unidad = (id: string | null) => (id ? (indicativos.get(id) ?? id) : null);
  const tipo = (id: string | null) => {
    const r = id ? recursos.find((x) => x.id === id) : undefined;
    return r ? textoTipoRecurso(t, r.tipo).toLowerCase() : '';
  };

  // Hitos que ya estaban al abrir el incidente no se animan; los que llegan después sí.
  const alcanzados = hitos.filter((h) => h.estado === 'hecho' || h.estado === 'actual').map((h) => h.hito);
  const firma = `${incidente.id}|${alcanzados.join(',')}`;
  const vistos = useRef<{ readonly id: string; readonly hitos: ReadonlySet<string> } | null>(null);
  const [nuevos, setNuevos] = useState<ReadonlySet<string>>(new Set());
  useEffect(() => {
    const [id = '', lista = ''] = firma.split('|');
    const actuales = new Set(lista ? lista.split(',') : []);
    const previos = vistos.current;
    vistos.current = { id, hitos: actuales };
    if (!previos || previos.id !== id) return;
    const llegados = [...actuales].filter((h) => !previos.hitos.has(h));
    if (llegados.length === 0) return;
    setNuevos(new Set(llegados));
    const temporizador = setTimeout(() => setNuevos(new Set()), 600);
    return () => clearTimeout(temporizador);
  }, [firma]);

  const texto = (h: HitoIncidente): string => {
    const u = unidad(h.recursoId);
    switch (h.hito) {
      case 'LLAMADA':
        return h.canal ? t('hito.LLAMADA.canal', { canal: h.canal }) : t('hito.LLAMADA');
      case 'DESPACHADA':
        return u ? t('hito.DESPACHADA.unidad', { unidad: u, tipo: tipo(h.recursoId) }) : t('hito.DESPACHADA');
      case 'EN_RUTA': {
        const eta = h.recursoId ? etas.get(h.recursoId) : undefined;
        if (u && eta && h.estado === 'actual') return t('hito.EN_RUTA.eta', { unidad: u, eta: formatearMinSeg(eta.restanteSeg) });
        return u ? t('hito.EN_RUTA.unidad', { unidad: u }) : t('hito.EN_RUTA');
      }
      case 'EN_ESCENA':
        return u ? t('hito.EN_ESCENA.unidad', { unidad: u }) : t('hito.EN_ESCENA');
      default:
        return t(`hito.${h.hito}`);
    }
  };

  const visibles = hitos.filter((h) => h.estado !== 'pendiente');
  const pendientes = hitos.filter((h) => h.estado === 'pendiente');

  return (
    <ol className="ag-linea" aria-label={t('detalle.timeline')}>
      {visibles.map((h, i) => {
        const siguiente = visibles[i + 1] ?? pendientes[0];
        const eta = h.hito === 'EN_RUTA' && h.estado === 'actual' && h.recursoId ? etas.get(h.recursoId) : undefined;
        return (
          <li key={h.hito} className="ag-linea__hito" data-estado={h.estado} data-nuevo={nuevos.has(h.hito) || undefined}>
            <span className="ag-linea__hora">
              {h.estado === 'actual' ? t('hito.ahora') : h.ms !== null ? formatearHora(new Date(h.ms).toISOString(), undefined, idioma) : '—'}
            </span>
            <span className="ag-linea__eje" aria-hidden="true">
              <span className="ag-linea__nodo" />
              {siguiente && <span className="ag-linea__tramo" data-hacia={siguiente.estado} />}
            </span>
            <span className="ag-linea__texto">
              <span>
                {texto(h)}
                {h.estado === 'omitido' && <span className="ag-linea__nota"> · {t('hito.omitido')}</span>}
              </span>
              {eta && (
                <span
                  className="ag-linea__eta"
                  role="progressbar"
                  aria-label={t('hito.eta.aria', { unidad: unidad(h.recursoId) ?? '' })}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(eta.progreso * 100)}
                >
                  <span style={{ width: `${Math.round(eta.progreso * 100)}%` }} />
                </span>
              )}
            </span>
          </li>
        );
      })}
      {pendientes.length > 0 && (
        <li className="ag-linea__hito" data-estado="pendiente">
          <span className="ag-linea__hora">—</span>
          <span className="ag-linea__eje" aria-hidden="true">
            <span className="ag-linea__nodo" />
          </span>
          <span className="ag-linea__texto">{pendientes.map((h, i) => (i === 0 ? t(`hito.${h.hito}`) : t(`hito.${h.hito}`).toLowerCase())).join(' · ')}</span>
        </li>
      )}
    </ol>
  );
}
