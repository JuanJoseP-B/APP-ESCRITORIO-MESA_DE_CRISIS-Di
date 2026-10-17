import { Ambulance, Flame, Shield, type LucideIcon } from 'lucide-react';
import type { EstadoSla, TipoRecurso } from '@argos/shared';
import { ESTADOS_RECURSO_UI, Glyph } from '@argos/ui';
import { textoEstadoRecurso, textoEstadoRecursoCorto, textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import type { UnidadMapa } from '../domain/unidadesMapa';
import { CronometroUnidad, datosCronometro, usePalabrasSla } from './CronometroUnidad';
import { ESTADO_RECURSO_UI } from './presentacion';
import './MarcadorUnidad.css';

export const ICONO_TIPO_UNIDAD: Readonly<Record<TipoRecurso, LucideIcon>> = {
  Bomberos: Flame,
  Ambulancia: Ambulance,
  Policía: Shield,
};

export interface MarcadorUnidadProps {
  readonly unidad: UnidadMapa;
  readonly seleccionada: boolean;
  readonly onSeleccionar: (id: string) => void;
  /** La unidad está dentro de la zona caliente de un incidente: se marca con glifo y palabra. */
  readonly alerta?: boolean;
  /** Resaltada desde otro panel (p. ej. al pasar el cursor por el análisis del perímetro). */
  readonly resaltada?: boolean;
  /** SLA del despacho en curso; el marcador lleva su cronómetro. */
  readonly sla?: EstadoSla;
  /** Menos movimiento: el cronómetro vencido no parpadea y se marca con rayas. */
  readonly reducirMovimiento?: boolean;
}

/**
 * Marcador de una unidad en el mapa: glifo del tipo, indicativo completo y estado (forma y palabra, además del
 * color). Los colores salen de tokens CSS, así que siguen solos el cambio de turno crema/carbón.
 */
export function MarcadorUnidad({ unidad, seleccionada, onSeleccionar, alerta = false, resaltada = false, sla, reducirMovimiento = false }: MarcadorUnidadProps) {
  const { t } = useTexto();
  const palabras = usePalabrasSla();
  const cronometro = datosCronometro(sla);
  const Icono = ICONO_TIPO_UNIDAD[unidad.tipo];
  const estadoUi = ESTADO_RECURSO_UI[unidad.estado];
  const tipo = textoTipoRecurso(t, unidad.tipo);
  const estado = textoEstadoRecurso(t, unidad.estado);
  const nombre = t(alerta ? 'marcador.unidad.aria.alerta' : 'marcador.unidad.aria', { unidad: unidad.indicativo, tipo, estado });
  const nivelSla = cronometro && cronometro.nivel !== 'en_tiempo' ? `, ${palabras[cronometro.nivel]}` : '';
  return (
    <button
      type="button"
      className={`ag-marcador ag-marcador--${estadoUi}`}
      data-tipo={unidad.tipo}
      data-atenuada={unidad.atenuada ? 'true' : undefined}
      data-alerta={alerta ? 'true' : undefined}
      data-resaltada={resaltada ? 'true' : undefined}
      aria-pressed={seleccionada}
      aria-label={cronometro ? `${nombre}, ${cronometro.tiempo}${nivelSla}` : nombre}
      title={`${unidad.indicativo} · ${tipo} · ${estado}`}
      onClick={(e) => {
        e.stopPropagation();
        onSeleccionar(unidad.id);
      }}
    >
      <Icono aria-hidden="true" size={14} strokeWidth={2.25} className="ag-marcador__icono" />
      <span className="ag-marcador__indicativo">{unidad.indicativo}</span>
      <span className="ag-marcador__estado">
        <Glyph shape={ESTADOS_RECURSO_UI[estadoUi].shape} />
        {textoEstadoRecursoCorto(t, unidad.estado)}
      </span>
      <CronometroUnidad sla={sla} reducirMovimiento={reducirMovimiento} className="ag-marcador__sla" />
      {alerta && (
        <span className="ag-marcador__alerta">
          <Glyph shape="square" />
          {t('marcador.alerta')}
        </span>
      )}
    </button>
  );
}
