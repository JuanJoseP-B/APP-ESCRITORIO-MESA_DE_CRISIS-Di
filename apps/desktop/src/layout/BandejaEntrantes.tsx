import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { Llamada } from '@argos/shared';
import { Badge, Button, SectionHeader, duracionSegundos } from '@argos/ui';
import { entrantes, esLlamadaNueva, nivelEspera, segundosDesde } from '../domain/entrantes';
import { formatearMinSeg } from '../domain/reloj';
import { textoTipoEmergencia } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { PRIORIDAD_UI } from './presentacion';

export interface BandejaEntrantesProps {
  readonly llamadas: readonly Llamada[];
  /** Hora de la consola (ms epoch): fija el tiempo de espera y cuánto dura el resaltado de las nuevas. */
  readonly ahora: number;
  /** Llamada que el formulario tiene abierta. */
  readonly abiertaId?: string | null;
  readonly onAbrir: (llamada: Llamada) => void;
  readonly onDescartar?: (llamada: Llamada) => void;
}

/** Curva de las islas para las tarjetas que entran y salen. */
const CURVA_ISLA = [0.22, 1, 0.36, 1] as const;

/**
 * Llamadas sin vincular, con la más urgente y reciente arriba, como tarjetas. El temporizador cambia de color a los
 * 2 min y parpadea en rojo a los 4 min. Enter o clic abren el formulario; «Descartar» la saca deslizando a la izquierda.
 */
export function BandejaEntrantes({ llamadas, ahora, abiertaId = null, onAbrir, onDescartar }: BandejaEntrantesProps) {
  const { t } = useTexto();
  const [abierta, setAbierta] = useState(true);
  const lista = entrantes(llamadas);
  // Con movimiento reducido el token vale 0: las tarjetas aparecen y desaparecen sin desplazarse.
  const duracion = duracionSegundos('base') > 0 ? 0.22 : 0;

  return (
    <section aria-label={t('entrantes.aria')} data-tutorial="entrantes" className="shrink-0">
      <SectionHeader
        index="01"
        title={t('entrantes.titulo')}
        count={lista.length}
        className="ag-reserva-toggle"
        action={
          <button
            type="button"
            className="ag-btn-mini"
            aria-expanded={abierta}
            aria-label={abierta ? t('entrantes.plegar') : t('entrantes.desplegar')}
            title={abierta ? t('entrantes.plegar') : t('entrantes.desplegar')}
            onClick={() => setAbierta((a) => !a)}
          >
            {abierta ? <ChevronUp aria-hidden="true" size={14} /> : <ChevronDown aria-hidden="true" size={14} />}
          </button>
        }
      />
      {abierta &&
        (lista.length === 0 ? (
          <p className="px-4 pb-2 font-mono text-data-sm text-[var(--isla-texto-2)]">{t('entrantes.vacio')}</p>
        ) : (
          <ul aria-label={t('entrantes.lista')} className="ag-scroll-fino flex max-h-64 flex-col gap-2 overflow-y-auto overflow-x-hidden px-4 pb-2 pt-1">
            <AnimatePresence initial={false}>
              {lista.map((l) => {
                const nueva = esLlamadaNueva(l, ahora);
                const prioridad = PRIORIDAD_UI[l.prioridad];
                const tipo = textoTipoEmergencia(t, l.tipo);
                const espera = segundosDesde(l, ahora);
                const nivel = nivelEspera(espera);
                return (
                  <motion.li
                    key={l.id}
                    layout={duracion > 0}
                    initial={duracion > 0 ? { opacity: 0, y: -16 } : false}
                    animate={{ opacity: 1, y: 0, x: 0 }}
                    exit={duracion > 0 ? { opacity: 0, x: -48, transition: { duration: duracion, ease: CURVA_ISLA } } : { opacity: 0 }}
                    transition={{ duration: duracion, ease: CURVA_ISLA }}
                    data-nueva={nueva || undefined}
                    data-espera={nivel}
                    data-abierta={l.id === abiertaId || undefined}
                    className="ag-entrante"
                  >
                    <button
                      type="button"
                      aria-label={t(nueva ? 'entrantes.abrir.nueva' : 'entrantes.abrir', { canal: l.canal, tipo, prioridad: l.prioridad })}
                      aria-current={l.id === abiertaId}
                      onClick={() => onAbrir(l)}
                      className="ag-entrante__abrir min-w-0"
                    >
                      <span className="flex items-center gap-2">
                        <Badge tone={prioridad.tone} emphasis={prioridad.emphasis}>
                          {l.prioridad}
                        </Badge>
                        <span className="truncate font-mono text-[11px] font-bold uppercase">{l.canal}</span>
                        <time className="ag-entrante__espera ml-auto font-mono text-[12px] font-bold tabular">{formatearMinSeg(espera)}</time>
                      </span>
                      <span className="flex min-w-0 items-center gap-2 pr-24">
                        <span className="truncate text-[13px]">{tipo}</span>
                        {nueva && (
                          <span className="shrink-0 font-mono text-[10px] font-bold uppercase text-[var(--texto-aviso)] motion-safe:animate-pulse">{t('entrantes.nueva')}</span>
                        )}
                      </span>
                    </button>
                    {onDescartar && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="ag-entrante__descartar shrink-0"
                        aria-label={t('entrantes.descartar.aria', { canal: l.canal, tipo })}
                        onClick={() => onDescartar(l)}
                      >
                        {t('entrantes.descartar')}
                      </Button>
                    )}
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        ))}
    </section>
  );
}
