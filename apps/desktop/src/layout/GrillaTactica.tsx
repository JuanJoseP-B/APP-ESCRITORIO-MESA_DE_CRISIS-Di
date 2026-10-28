import type { ReactNode } from 'react';
import { FileText, Inbox } from 'lucide-react';
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
  className?: string;
}

/**
 * Zero-Scroll Tactical Grid (ROADMAP_CAD §2.1) en islas flotantes: cinco áreas fijas sobre `100dvh`. La página nunca
 * desplaza; solo las listas internas de B y D llevan `overflow-y: auto`. El mapa es la isla central.
 */
export function GrillaTactica({ barra, cola, mapa, detalle, tablero, panelCola, panelDetalle, className }: GrillaTacticaProps) {
  const { t } = useTexto();
  useAtajos({ '[': panelCola.alternar, ']': panelDetalle.alternar });

  return (
    <div
      className={`ag-grilla ${className ?? ''}`.trim()}
      data-cola={panelCola.colapsado ? 'colapsada' : 'expandida'}
      data-detalle={panelDetalle.colapsado ? 'colapsado' : 'expandido'}
    >
      <div className="ag-grilla__barra" data-area="barra" data-tutorial="barra">
        {barra}
      </div>
      <RailColapsable
        className="ag-grilla__cola ag-isla"
        label={t('cola.rail')}
        side="left"
        shortcut="["
        icon={<Inbox aria-hidden="true" size={18} />}
        collapsed={panelCola.colapsado}
        onToggle={panelCola.alternar}
      >
        <div data-area="cola" data-tutorial="cola" className="ag-grilla__contenido">
          {cola}
        </div>
      </RailColapsable>
      <main className="ag-grilla__mapa" data-area="mapa" data-tutorial="mapa">
        {mapa}
      </main>
      <RailColapsable
        className="ag-grilla__detalle ag-isla"
        label={t('detalle.rail')}
        side="right"
        shortcut="]"
        icon={<FileText aria-hidden="true" size={18} />}
        collapsed={panelDetalle.colapsado}
        onToggle={panelDetalle.alternar}
      >
        <div data-area="detalle" data-tutorial="detalle" className="ag-grilla__contenido">
          {detalle}
        </div>
      </RailColapsable>
      <div className="ag-grilla__tablero ag-isla" role="region" aria-label={t('tablero.aria')} data-area="tablero" data-tutorial="tablero">
        {tablero}
      </div>
    </div>
  );
}
