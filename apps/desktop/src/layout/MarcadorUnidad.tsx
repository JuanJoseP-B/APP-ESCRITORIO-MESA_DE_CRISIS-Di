import { Ambulance, Flame, Shield, type LucideIcon } from 'lucide-react';
import type { TipoRecurso } from '@argos/shared';
import { ESTADOS_RECURSO_UI, Glyph } from '@argos/ui';
import { textoEstadoRecurso, textoEstadoRecursoCorto, textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import type { UnidadMapa } from '../domain/unidadesMapa';
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
}

/**
 * Marcador de una unidad en el mapa: glifo del tipo, indicativo completo y estado (forma y palabra, además del
 * color). Los colores salen de tokens CSS, así que siguen solos el cambio de turno crema/carbón.
 */
export function MarcadorUnidad({ unidad, seleccionada, onSeleccionar, alerta = false, resaltada = false }: MarcadorUnidadProps) {
  const { t } = useTexto();
  const Icono = ICONO_TIPO_UNIDAD[unidad.tipo];
  const estadoUi = ESTADO_RECURSO_UI[unidad.estado];
  const tipo = textoTipoRecurso(t, unidad.tipo);
  const estado = textoEstadoRecurso(t, unidad.estado);
  return (
    <button
      type="button"
      className={`ag-marcador ag-marcador--${estadoUi}`}
      data-tipo={unidad.tipo}
      data-atenuada={unidad.atenuada ? 'true' : undefined}
      data-alerta={alerta ? 'true' : undefined}
      data-resaltada={resaltada ? 'true' : undefined}
      aria-pressed={seleccionada}
      aria-label={t(alerta ? 'marcador.unidad.aria.alerta' : 'marcador.unidad.aria', { unidad: unidad.indicativo, tipo, estado })}
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
      {alerta && (
        <span className="ag-marcador__alerta">
          <Glyph shape="square" />
          {t('marcador.alerta')}
        </span>
      )}
    </button>
  );
}
