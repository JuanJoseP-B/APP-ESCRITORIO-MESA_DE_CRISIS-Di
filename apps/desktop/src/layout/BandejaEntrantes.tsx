import { useState } from 'react';
import type { Llamada } from '@argos/shared';
import { Badge, Button, SectionHeader } from '@argos/ui';
import { entrantes, esLlamadaNueva, segundosDesde } from '../domain/entrantes';
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

/** Llamadas sin vincular, con la más urgente y reciente arriba. Enter o clic abren el formulario. */
export function BandejaEntrantes({ llamadas, ahora, abiertaId = null, onAbrir, onDescartar }: BandejaEntrantesProps) {
  const { t } = useTexto();
  const [abierta, setAbierta] = useState(true);
  const lista = entrantes(llamadas);

  return (
    <section aria-label={t('entrantes.aria')} className="shrink-0">
      <div className="flex items-center">
        <div className="flex-1">
          <SectionHeader index="01" title={t('entrantes.titulo')} count={lista.length} />
        </div>
        <Button size="sm" variant="ghost" className="mr-2" aria-expanded={abierta} onClick={() => setAbierta((a) => !a)}>
          {abierta ? t('entrantes.plegar') : t('entrantes.desplegar')}
        </Button>
      </div>
      {abierta &&
        (lista.length === 0 ? (
          <p className="px-4 pb-3 font-mono text-data-sm text-text-muted">{t('entrantes.vacio')}</p>
        ) : (
          <ul aria-label={t('entrantes.lista')} className="max-h-56 overflow-y-auto pb-2">
            {lista.map((l) => {
              const nueva = esLlamadaNueva(l, ahora);
              const prioridad = PRIORIDAD_UI[l.prioridad];
              const tipo = textoTipoEmergencia(t, l.tipo);
              return (
                <li
                  key={l.id}
                  data-nueva={nueva || undefined}
                  className={`flex items-center border-b border-border-subtle ${nueva ? 'bg-status-warning-bg' : ''} ${l.id === abiertaId ? 'bg-surface-selected' : ''}`}
                >
                  <button
                    type="button"
                    aria-label={t(nueva ? 'entrantes.abrir.nueva' : 'entrantes.abrir', { canal: l.canal, tipo, prioridad: l.prioridad })}
                    aria-current={l.id === abiertaId}
                    onClick={() => onAbrir(l)}
                    className="grid min-h-row flex-1 grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-2 text-left hover:bg-surface-hover"
                  >
                    <Badge tone={prioridad.tone} emphasis={prioridad.emphasis}>
                      {l.prioridad}
                    </Badge>
                    <span className="font-mono text-overline uppercase text-text-secondary">{l.canal}</span>
                    <time className="font-mono text-data-sm tabular text-text-secondary">{formatearMinSeg(segundosDesde(l, ahora))}</time>
                    <span className="col-span-2 font-ui text-body-sm text-text-primary">{tipo}</span>
                    {nueva && (
                      <span className="font-mono text-overline uppercase text-status-warning motion-safe:animate-pulse">{t('entrantes.nueva')}</span>
                    )}
                  </button>
                  {onDescartar && (
                    <Button size="sm" variant="ghost" className="mr-2" aria-label={t('entrantes.descartar.aria', { canal: l.canal, tipo })} onClick={() => onDescartar(l)}>
                      {t('entrantes.descartar')}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        ))}
    </section>
  );
}
