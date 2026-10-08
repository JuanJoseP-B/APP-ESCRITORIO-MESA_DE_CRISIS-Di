import type { ReactNode } from 'react';
import { RailColapsable } from '@argos/ui';
import { useTexto } from '../i18n/IdiomaProvider';
import { useAtajos } from '../hooks/useAtajos';
import type { PanelColapsable } from '../hooks/usePanelColapsable';
import './GrillaTactica.css';

export interface GrillaTacticaProps {
  /** A · barra de estado (40 px). */
  barra: ReactNode;
  /** B · cola de incidentes (izquierda, colapsable con `[`). */
  cola: ReactNode;
  /** C · mapa táctico (1fr). */
  mapa: ReactNode;
  /** D · detalle del incidente (derecha, colapsable con `]`). */
  detalle: ReactNode;
  /** E · tablero de unidades (96 px). */
  tablero: ReactNode;
  panelCola: PanelColapsable;
  panelDetalle: PanelColapsable;
}

/**
 * Zero-Scroll Tactical Grid (ROADMAP_CAD §2.1): cinco áreas fijas sobre `100dvh`. La página nunca
 * desplaza; solo las listas internas de B y D llevan `overflow-y: auto`.
 */
export function GrillaTactica({ barra, cola, mapa, detalle, tablero, panelCola, panelDetalle }: GrillaTacticaProps) {
  const { t } = useTexto();
  useAtajos({ '[': panelCola.alternar, ']': panelDetalle.alternar });

  return (
    <div
      className="ag-grilla"
      data-cola={panelCola.colapsado ? 'colapsada' : 'expandida'}
      data-detalle={panelDetalle.colapsado ? 'colapsado' : 'expandido'}
    >
      <div className="ag-grilla__barra" data-area="barra">
        {barra}
      </div>
      <RailColapsable
        className="ag-grilla__cola"
        label={t('cola.rail')}
        side="left"
        shortcut="["
        collapsed={panelCola.colapsado}
        onToggle={panelCola.alternar}
      >
        <div data-area="cola" className="ag-grilla__contenido">
          {cola}
        </div>
      </RailColapsable>
      <main className="ag-grilla__mapa" data-area="mapa">
        {mapa}
      </main>
      <RailColapsable
        className="ag-grilla__detalle"
        label={t('detalle.rail')}
        side="right"
        shortcut="]"
        collapsed={panelDetalle.colapsado}
        onToggle={panelDetalle.alternar}
      >
        <div data-area="detalle" className="ag-grilla__contenido">
          {detalle}
        </div>
      </RailColapsable>
      <div className="ag-grilla__tablero" role="region" aria-label={t('tablero.aria')} data-area="tablero">
        {tablero}
      </div>
    </div>
  );
}
