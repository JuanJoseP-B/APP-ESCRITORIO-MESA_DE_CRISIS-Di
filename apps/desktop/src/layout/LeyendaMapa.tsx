import { useId, useState, type ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { ANILLOS, TIPOS_RECURSO } from '@argos/shared';
import { Glyph, StatusIndicator, Switch, type FormaGlifo } from '@argos/ui';
import { CAPAS_MAPA, type CapaMapa, type CapasMapa } from '../domain/capasMapa';
import { textoEstadoRecurso, textoTipoRecurso } from '../i18n/etiquetas';
import type { ClaveTexto } from '../i18n/es';
import { useTexto } from '../i18n/IdiomaProvider';
import { ICONO_TIPO_UNIDAD } from './MarcadorUnidad';
import { ESTADO_RECURSO_UI } from './presentacion';
import './LeyendaMapa.css';

const CLAVE_PLEGADA = 'argos.leyendaPlegada';

interface Entrada {
  readonly palabra: ClaveTexto;
  readonly shape: FormaGlifo;
  readonly clase: string;
}

/** Cada entrada repite el color de su capa (ver `domain/geojson.ts`) con glifo y palabra. */
const INCIDENTES: readonly Entrada[] = [
  { palabra: 'leyenda.critico', shape: 'square', clase: 'text-status-critical' },
  { palabra: 'leyenda.medio', shape: 'triangle', clase: 'text-status-warning' },
  { palabra: 'leyenda.bajo', shape: 'circle', clase: 'text-status-success' },
  { palabra: 'leyenda.llamada', shape: 'ring', clase: 'text-text-primary' },
];

const ZONAS: readonly Entrada[] = [
  { palabra: 'leyenda.refugio', shape: 'circle', clase: 'text-status-success' },
  { palabra: 'leyenda.bloqueo', shape: 'triangle', clase: 'text-status-warning' },
];

const ESTADOS_UNIDAD = Object.keys(ESTADO_RECURSO_UI) as (keyof typeof ESTADO_RECURSO_UI)[];

const CLAVE_CAPA: Readonly<Record<CapaMapa, ClaveTexto>> = {
  unidades: 'capa.unidades',
  perimetros: 'capa.perimetros',
  refugios: 'capa.refugios',
  bloqueos: 'capa.bloqueos',
};

/** Plegada por defecto: desplegada tapa el centro del mapa, donde se centra el incidente. Solo se despliega si el operador lo pidió. */
function plegadaGuardada(): boolean {
  try {
    return localStorage.getItem(CLAVE_PLEGADA) !== 'false';
  } catch {
    return true;
  }
}

function guardarPlegada(plegada: boolean): void {
  try {
    localStorage.setItem(CLAVE_PLEGADA, String(plegada));
  } catch {
    // Sin almacenamiento la leyenda arranca plegada cada vez: no pasa nada.
  }
}

function Grupo({ titulo, children }: { readonly titulo: string; readonly children: ReactNode }) {
  return (
    <div>
      <p className="font-mono text-overline uppercase text-text-muted">{titulo}</p>
      <ul aria-label={titulo} className="mt-1 space-y-1 font-mono text-data-sm text-text-primary">
        {children}
      </ul>
    </div>
  );
}

function Fila({ simbolo, children }: { readonly simbolo: ReactNode; readonly children: ReactNode }) {
  return (
    <li className="flex items-center gap-2">
      {simbolo}
      {children}
    </li>
  );
}

export interface LeyendaMapaProps {
  readonly capas: CapasMapa;
  readonly onCambiarCapa: (capa: CapaMapa) => void;
}

/** Leyenda plegable del mapa con todos sus símbolos y los interruptores de capa: panel sólido, sin transparencias. */
export function LeyendaMapa({ capas, onCambiarCapa }: LeyendaMapaProps) {
  const { t } = useTexto();
  const idCuerpo = useId();
  const [plegada, setPlegada] = useState(plegadaGuardada);
  const alternar = (): void => {
    guardarPlegada(!plegada);
    setPlegada(!plegada);
  };
  const entradas = (lista: readonly Entrada[]) =>
    lista.map((e) => (
      <Fila
        key={e.palabra}
        simbolo={
          <span className={e.clase}>
            <Glyph shape={e.shape} />
          </span>
        }
      >
        {t(e.palabra)}
      </Fila>
    ));

  return (
    <section aria-label={t('leyenda.aria')} className="ag-leyenda border border-border-strong bg-surface-panel shadow-overlay">
      <h2 className="m-0">
        <button
          type="button"
          className="ag-leyenda__cabecera"
          aria-expanded={!plegada}
          aria-controls={idCuerpo}
          onClick={alternar}
        >
          <span className="font-mono text-overline uppercase text-text-secondary">{t('leyenda.titulo')}</span>
          {plegada ? <ChevronUp aria-hidden="true" size={16} /> : <ChevronDown aria-hidden="true" size={16} />}
        </button>
      </h2>
      <div id={idCuerpo} hidden={plegada} className="ag-leyenda__cuerpo">
        <div className="ag-leyenda__columnas">
          <Grupo titulo={t('leyenda.grupo.incidentes')}>{entradas(INCIDENTES)}</Grupo>
          <Grupo titulo={t('leyenda.grupo.zonas')}>{entradas(ZONAS)}</Grupo>
          <Grupo titulo={t('leyenda.grupo.unidades')}>
            {TIPOS_RECURSO.map((tipo) => {
              const Icono = ICONO_TIPO_UNIDAD[tipo];
              return (
                <Fila key={tipo} simbolo={<Icono aria-hidden="true" size={14} strokeWidth={2.25} />}>
                  {textoTipoRecurso(t, tipo)}
                </Fila>
              );
            })}
            {ESTADOS_UNIDAD.map((estado) => (
              <li key={estado}>
                <StatusIndicator status={ESTADO_RECURSO_UI[estado]} label={textoEstadoRecurso(t, estado)} />
              </li>
            ))}
            <Fila
              simbolo={
                <span className="text-status-critical">
                  <Glyph shape="square" />
                </span>
              }
            >
              {t('leyenda.alertaCaliente')}
            </Fila>
            <Fila simbolo={<span aria-hidden="true" className="ag-leyenda__trazo ag-leyenda__trazo--ruta" />}>{t('leyenda.ruta')}</Fila>
          </Grupo>
          <Grupo titulo={t('leyenda.grupo.perimetro')}>
            {ANILLOS.map((anillo) => (
              <Fila key={anillo} simbolo={<span aria-hidden="true" className={`ag-leyenda__trazo ag-leyenda__trazo--${anillo}`} />}>
                {t(`anillo.${anillo}`)}
              </Fila>
            ))}
          </Grupo>
        </div>
        <div role="group" aria-label={t('leyenda.grupo.capas')} className="ag-leyenda__capas">
          <p className="font-mono text-overline uppercase text-text-muted">{t('leyenda.grupo.capas')}</p>
          {CAPAS_MAPA.map((capa) => (
            <Switch
              key={capa}
              label={t(CLAVE_CAPA[capa])}
              checked={capas[capa]}
              onChange={() => onCambiarCapa(capa)}
              onLabel={t('capa.visible')}
              offLabel={t('capa.oculta')}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
