import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw, Settings, Volume2, VolumeX } from 'lucide-react';
import { Button, ContadorRodante, Glyph, SegmentedControl, duracion, type FormaGlifo } from '@argos/ui';
import type { EstadoEnlace } from '../domain/conexion';
import { IDS_ESCENARIO, type IdEscenario } from '../domain/escenario';
import { useTexto } from '../i18n/IdiomaProvider';
import { etiquetaZonaHoraria, formatearHoraConSegundos, formatearMinSeg } from '../domain/reloj';
import { VELOCIDADES, type Velocidad } from '../domain/relojSimulado';
import { useCapaEscape } from '../hooks/useCapaEscape';
import type { Tema } from '../tema';
import './BarraEstado.css';

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
  /** Escenario activo y cómo cambiarlo; el selector solo se ofrece antes de iniciar (t = 0). */
  escenario?: { actual: IdEscenario; onElegir: (id: IdEscenario) => void };
}

export interface BarraEstadoProps {
  /** Hora corregida (ms epoch), p. ej. de `useReloj`. */
  hora: number;
  /** Zona IANA; por defecto la del sistema. */
  zona?: string;
  /** Tema que se pinta: de él sale el turno (crema = día, carbón = noche). */
  turno: Tema;
  operador: string;
  enlace: EstadoEnlace;
  /** Unidades en ALERTA o VENCIDO; el contador solo se muestra si es mayor que 0. */
  slaEnRiesgo?: number;
  /** Nivel más grave entre ellas: da el color y el glifo del contador. */
  slaNivel?: 'ALERTA' | 'VENCIDO';
  /** La cola está filtrada por SLA. */
  filtroSlaActivo?: boolean;
  /** Llamadas sin vincular en la bandeja de entrantes. */
  entrantes?: number;
  onFiltrarSla?: () => void;
  simulacion?: SimulacionBarra;
  onCerrarSesion?: () => void;
  onAbrirAjustes?: () => void;
  /** Silencio rápido: el altavoz solo se ofrece si se pasa `onAlternarSonido`. */
  sonidoActivo?: boolean;
  onAlternarSonido?: () => void;
}

const ENLACE_UI: Record<EstadoEnlace, { shape: FormaGlifo; clase: string }> = {
  EN_VIVO: { shape: 'circle', clase: 'ag-chip-barra--ok' },
  CONECTANDO: { shape: 'diamond', clase: 'ag-chip-barra--info' },
  SIN_ENLACE: { shape: 'square', clase: 'ag-chip-barra--critico' },
};

/** Dos letras para el avatar: iniciales de las dos primeras partes del usuario ("ana.ruiz" → "AR") o sus dos primeras letras. */
export function inicialesDe(operador: string): string {
  const usuario = operador.split('@')[0] ?? '';
  const partes = usuario.split(/[._\-\s]+/).filter(Boolean);
  const letras = partes.length >= 2 ? `${partes[0]?.[0] ?? ''}${partes[1]?.[0] ?? ''}` : usuario.slice(0, 2);
  return letras.toUpperCase() || '··';
}

/** Avatar con las iniciales del operador; abre un menú con «Salir». Esc o un clic fuera lo cierran. */
function MenuCuenta({ operador, onCerrarSesion }: { readonly operador: string; readonly onCerrarSesion: () => void }) {
  const { t } = useTexto();
  const [abierto, setAbierto] = useState(false);
  const raiz = useRef<HTMLDivElement>(null);
  const boton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: PointerEvent) => {
      if (e.target instanceof Node && !raiz.current?.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('pointerdown', fuera);
    return () => document.removeEventListener('pointerdown', fuera);
  }, [abierto]);
  return (
    <div ref={raiz} className="relative">
      <button
        ref={boton}
        type="button"
        className="ag-avatar"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-label={t('barra.cuenta.aria', { operador })}
        title={operador}
        onClick={() => setAbierto((a) => !a)}
      >
        {inicialesDe(operador)}
      </button>
      {abierto && (
        <MenuAbierto
          operador={operador}
          onCerrar={() => {
            setAbierto(false);
            boton.current?.focus();
          }}
          onCerrarSesion={() => {
            setAbierto(false);
            onCerrarSesion();
          }}
        />
      )}
    </div>
  );
}

function MenuAbierto({ operador, onCerrar, onCerrarSesion }: { readonly operador: string; readonly onCerrar: () => void; readonly onCerrarSesion: () => void }) {
  const { t } = useTexto();
  useCapaEscape(onCerrar);
  const primero = useRef<HTMLButtonElement>(null);
  useEffect(() => primero.current?.focus(), []);
  return (
    <div role="menu" aria-label={t('barra.cuenta.menu')} className="ag-isla ag-menu-cuenta">
      <p className="ag-menu-cuenta__quien">{operador}</p>
      <button ref={primero} type="button" role="menuitem" className="ag-menu-cuenta__item" onClick={onCerrarSesion}>
        {t('barra.salir')}
      </button>
    </div>
  );
}

/** Velocidades del demo como control segmentado: un «thumb» claro se desliza a la elegida. */
function SelectorVelocidad({ velocidad, onVelocidad }: { readonly velocidad: Velocidad; readonly onVelocidad: (v: Velocidad) => void }) {
  const { t } = useTexto();
  const indice = Math.max(0, VELOCIDADES.indexOf(velocidad));
  return (
    <span role="group" aria-label={t('barra.sim.velocidad')} className="ag-velocidades" style={{ ['--ag-vel-n' as string]: VELOCIDADES.length, ['--ag-vel-i' as string]: indice }}>
      <span aria-hidden="true" className="ag-velocidades__thumb" />
      {VELOCIDADES.map((v) => (
        <button
          key={v}
          type="button"
          className="ag-velocidades__opt"
          aria-pressed={v === velocidad}
          aria-label={t('barra.sim.velocidad.aria', { v })}
          onClick={() => onVelocidad(v)}
        >
          <span className="tabular">{v}×</span>
        </button>
      ))}
    </span>
  );
}

/** A · barra superior en tres islas: marca y reloj · operación (enlace, entrantes, SLA, simulación) · sistema. */
export function BarraEstado({
  hora,
  zona,
  turno,
  operador,
  enlace,
  slaEnRiesgo = 0,
  slaNivel = 'ALERTA',
  filtroSlaActivo = false,
  entrantes,
  onFiltrarSla,
  simulacion,
  onCerrarSesion,
  onAbrirAjustes,
  sonidoActivo = true,
  onAlternarSonido,
}: BarraEstadoProps) {
  const { t, idioma } = useTexto();
  const estadoEnlace = ENLACE_UI[enlace];
  const palabraEnlace = t(`enlace.${enlace}`);
  const nombreTurno = turno === 'carbon' ? t('barra.turno.noche') : t('barra.turno.dia');
  /** Mientras t=0 y en pausa, el escenario aún no ha empezado. */
  const sinIniciar = simulacion !== undefined && !simulacion.reproduciendo && simulacion.tSeg === 0;
  /** Con el selector a la vista el reloj (siempre 00:00) sobra: la barra no tiene sitio para ambos a 1366 px. */
  const eligiendoEscenario = sinIniciar && simulacion?.escenario !== undefined;
  const horaCompleta = formatearHoraConSegundos(hora, zona, idioma);
  const avance = simulacion && simulacion.duracionSeg > 0 ? Math.min(100, (simulacion.tSeg / simulacion.duracionSeg) * 100) : 0;

  const previoEntrantes = useRef(entrantes ?? 0);
  const [golpeEntrantes, setGolpeEntrantes] = useState(false);
  useEffect(() => {
    if (entrantes !== undefined && entrantes > previoEntrantes.current) {
      setGolpeEntrantes(true);
      const timer = setTimeout(() => setGolpeEntrantes(false), duracion('fast') || 150);
      previoEntrantes.current = entrantes;
      return () => clearTimeout(timer);
    }
    previoEntrantes.current = entrantes ?? 0;
  }, [entrantes]);

  return (
    <header aria-label={t('barra.aria')} className="ag-barra">
      {/* 1 · Marca, reloj, turno y operador. */}
      <div className="ag-isla ag-barra__isla ag-barra__marca">
        <span className="ag-barra__logo">
          <span aria-hidden="true" className="text-[var(--acento-naranja)]">■</span> ARGOS
        </span>
        <span aria-hidden="true" className="ag-barra__separador" />
        <time dateTime={new Date(hora).toISOString()} className="ag-barra__reloj">
          {horaCompleta.slice(0, 5)}
          <span className="ag-barra__segundos">{horaCompleta.slice(5)}</span>
        </time>
        <span className="ag-barra__turno">
          <span className="ag-barra__turno-linea">
            {t('barra.turno', { turno: nombreTurno })} · <span>{etiquetaZonaHoraria(hora, zona)}</span>
          </span>
          {operador ? (
            <span className="ag-barra__operador" title={operador}>
              {operador}
            </span>
          ) : null}
        </span>
      </div>

      {/* 2 · Operación: enlace, entrantes, SLA y simulación. */}
      <div className="ag-isla ag-barra__isla ag-barra__operacion">
        <span role="status" aria-label={t('barra.enlace.aria', { estado: palabraEnlace })} className={`ag-chip-barra ${estadoEnlace.clase}`}>
          <Glyph shape={estadoEnlace.shape} className={enlace === 'EN_VIVO' ? 'ag-punto-vivo' : undefined} />
          {palabraEnlace}
        </span>
        {entrantes !== undefined && (
          <span
            role="status"
            data-golpe={golpeEntrantes || undefined}
            aria-label={t('barra.entrantes.aria', { n: entrantes })}
            className={`ag-chip-barra ${entrantes > 0 ? 'ag-chip-barra--aviso' : 'ag-chip-barra--neutro'} ${golpeEntrantes ? 'ag-contador-golpe' : ''}`}
          >
            <Glyph shape={entrantes > 0 ? 'triangle' : 'ring'} />
            <ContadorRodante className="tabular" valor={entrantes} /> {t('barra.entrantes')}
          </span>
        )}
        {slaEnRiesgo > 0 && (
          <Button
            size="sm"
            variant="ghost"
            aria-label={t('barra.sla.aria', { n: slaEnRiesgo, nivel: slaNivel === 'VENCIDO' ? t('sla.vencido') : t('sla.alerta') })}
            aria-pressed={filtroSlaActivo}
            onClick={onFiltrarSla}
            className={`font-mono font-bold ${slaNivel === 'VENCIDO' ? 'text-status-critical' : 'text-status-warning'}`}
          >
            <Glyph shape={slaNivel === 'VENCIDO' ? 'square' : 'triangle'} /> <ContadorRodante className="tabular" valor={slaEnRiesgo} /> SLA
          </Button>
        )}
        {simulacion && (
          <div role="group" aria-label={t('barra.sim.aria')} className="ag-barra__sim">
            {eligiendoEscenario && simulacion.escenario ? (
              <span className="flex min-w-0 items-center gap-2" title={t(`escenario.${simulacion.escenario.actual}.desc`)}>
                <SegmentedControl
                  label={t('escenario.aria')}
                  options={IDS_ESCENARIO.map((id) => ({ value: id, label: id }))}
                  value={simulacion.escenario.actual}
                  onChange={simulacion.escenario.onElegir}
                />
                <span className="max-w-36 truncate text-[13px] font-medium">{t(`escenario.${simulacion.escenario.actual}.titulo`)}</span>
              </span>
            ) : (
              <span className="ag-barra__progreso">
                <span className="ag-barra__etiqueta">{t('barra.sim')}</span>
                <span className="ag-barra__pista" aria-hidden="true">
                  <span className="ag-barra__relleno" style={{ width: `${avance}%` }} />
                </span>
                <span className="ag-barra__tiempo tabular">
                  {formatearMinSeg(simulacion.tSeg)} / {formatearMinSeg(simulacion.duracionSeg)}
                </span>
              </span>
            )}
            {sinIniciar ? (
              <Button size="sm" variant="primary" onClick={simulacion.onAlternar}>
                <Play aria-hidden="true" size={14} /> {t('barra.sim.iniciar')}
              </Button>
            ) : (
              <button
                type="button"
                className="ag-btn-icono"
                aria-label={simulacion.reproduciendo ? t('barra.sim.pausar') : t('barra.sim.reproducir')}
                title={simulacion.reproduciendo ? t('barra.sim.pausar') : t('barra.sim.reproducir')}
                onClick={simulacion.onAlternar}
              >
                {simulacion.reproduciendo ? <Pause aria-hidden="true" size={16} fill="currentColor" /> : <Play aria-hidden="true" size={16} fill="currentColor" />}
              </button>
            )}
            <SelectorVelocidad velocidad={simulacion.velocidad} onVelocidad={simulacion.onVelocidad} />
            {!sinIniciar && (
              <button type="button" className="ag-btn-icono" aria-label={t('barra.sim.reiniciar')} title={t('barra.sim.reiniciar')} onClick={simulacion.onReiniciar}>
                <RotateCcw aria-hidden="true" size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3 · Sistema: sonido, ajustes y cuenta. */}
      {(onAlternarSonido || onAbrirAjustes || onCerrarSesion) && (
        <div className="ag-isla ag-barra__isla ag-barra__sistema">
          {onAlternarSonido && (
            <button
              type="button"
              className="ag-btn-icono"
              aria-pressed={!sonidoActivo}
              aria-label={t('barra.sonido.silenciar')}
              title={sonidoActivo ? t('barra.sonido.silenciar') : t('barra.sonido.activar')}
              onClick={onAlternarSonido}
            >
              {sonidoActivo ? <Volume2 aria-hidden="true" size={18} /> : <VolumeX aria-hidden="true" size={18} />}
            </button>
          )}
          {onAbrirAjustes && (
            <button
              type="button"
              className="ag-btn-icono ag-btn-icono--engranaje"
              aria-label={t('barra.ajustes')}
              data-tutorial="ajustes"
              aria-haspopup="dialog"
              title={t('barra.ajustes')}
              onClick={onAbrirAjustes}
            >
              <Settings aria-hidden="true" size={18} />
            </button>
          )}
          {onCerrarSesion && <MenuCuenta operador={operador} onCerrarSesion={onCerrarSesion} />}
        </div>
      )}
    </header>
  );
}
