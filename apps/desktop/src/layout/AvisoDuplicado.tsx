import { useEffect, type FocusEvent } from 'react';
import type { CandidatoDuplicado } from '@argos/shared';
import { Button, Glyph } from '@argos/ui';
import { describirCandidato } from '../domain/duplicados';
import { useTexto } from '../i18n/IdiomaProvider';

export interface AvisoDuplicadoProps {
  /** Hasta tres, del más probable al menos. */
  readonly candidatos: readonly CandidatoDuplicado[];
  readonly onVincular: (candidato: CandidatoDuplicado) => void;
  /** Incidente al que apunta el cursor o el foco (se resalta en el mapa); `null` al salir. */
  readonly onResaltar: (incidenteId: string | null) => void;
  readonly deshabilitado?: boolean;
}

/** Aviso dentro del formulario: la llamada podría ser de un incidente ya abierto. */
export function AvisoDuplicado({ candidatos, onVincular, onResaltar, deshabilitado = false }: AvisoDuplicadoProps) {
  const { t, idioma } = useTexto();
  // Si el aviso desaparece (se arregló la ubicación, se vinculó, se cerró) no puede quedar nada resaltado.
  useEffect(() => () => onResaltar(null), [onResaltar]);
  useEffect(() => {
    if (candidatos.length === 0) onResaltar(null);
  }, [candidatos.length, onResaltar]);

  if (candidatos.length === 0) return null;
  const alSalirDelFoco = (e: FocusEvent<HTMLLIElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onResaltar(null);
  };

  return (
    <section
      role="region"
      aria-label={t('duplicado.aria')}
      aria-live="polite"
      className="flex flex-col gap-2 border border-status-warning bg-status-warning-bg p-3"
    >
      <h3 className="flex items-center gap-2 font-mono text-overline uppercase text-status-warning">
        <Glyph shape="triangle" />
        {candidatos.length === 1 ? t('duplicado.uno') : t('duplicado.varios', { n: candidatos.length })}
      </h3>
      <ul className="flex flex-col gap-2">
        {candidatos.map((c) => (
          <li
            key={c.incidenteId}
            data-candidato={c.incidenteId}
            onMouseEnter={() => onResaltar(c.incidenteId)}
            onMouseLeave={() => onResaltar(null)}
            onFocus={() => onResaltar(c.incidenteId)}
            onBlur={alSalirDelFoco}
            className="flex items-center gap-3"
          >
            <span className="flex-1 font-ui text-body-sm text-text-primary">
              {t('duplicado.de')} <span className="font-mono font-semibold tabular">#{c.codigo}</span>
              <span className="block font-mono text-data-sm tabular text-text-secondary">{describirCandidato(c, idioma)}</span>
            </span>
            <Button
              size="sm"
              variant="secondary"
              disabled={deshabilitado}
              aria-label={t('duplicado.vincular.aria', { codigo: c.codigo })}
              onClick={() => onVincular(c)}
            >
              {t('duplicado.vincular')}
            </Button>
          </li>
        ))}
      </ul>
      <p className="font-ui text-body-sm text-text-secondary">{t('duplicado.ayuda')}</p>
    </section>
  );
}
