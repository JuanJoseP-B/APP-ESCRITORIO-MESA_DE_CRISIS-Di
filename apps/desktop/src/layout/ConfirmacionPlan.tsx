import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { RecomendacionAsesor, SnapshotAsesor } from '@argos/shared';
import { Button, Glyph, Kbd, SectionHeader } from '@argos/ui';
import { accionesDeRecomendacion, claveAccion, type AccionAsesor } from '../domain/asesor';
import { useAtajos } from '../hooks/useAtajos';
import { textoTipoRecurso } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';

export interface ConfirmacionPlanProps {
  readonly snapshot: SnapshotAsesor;
  readonly recomendacion: RecomendacionAsesor;
  /** Claves (`claveAccion`) de las acciones que el operador dejó marcadas. */
  readonly onConfirmar: (marcadas: ReadonlySet<string>) => void;
  readonly onCancelar: () => void;
}

/**
 * Confirmación por acción de la sugerencia del asesor: cada acción en una línea marcable, todas marcadas al abrir.
 * Espacio marca o desmarca, Enter confirma lo marcado y Esc cancela sin ejecutar nada. Como el despacho por teclado,
 * no es modal: el mapa y la cola siguen a la vista, y el foco vuelve a donde estaba al cerrar.
 */
export function ConfirmacionPlan({ snapshot, recomendacion, onConfirmar, onCancelar }: ConfirmacionPlanProps) {
  const { t } = useTexto();
  const acciones = accionesDeRecomendacion(recomendacion);
  const [marcadas, setMarcadas] = useState<ReadonlySet<string>>(() => new Set(acciones.map(claveAccion)));
  const raiz = useRef<HTMLElement>(null);

  useEffect(() => {
    const previo = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    raiz.current?.querySelector<HTMLElement>('input[type="checkbox"]')?.focus();
    return () => {
      if (previo?.isConnected) previo.focus();
    };
  }, []);

  useAtajos({ Escape: onCancelar });

  const alternar = (clave: string) =>
    setMarcadas((actuales) => {
      const nuevas = new Set(actuales);
      if (!nuevas.delete(clave)) nuevas.add(clave);
      return nuevas;
    });
  const confirmar = () => {
    if (marcadas.size > 0) onConfirmar(marcadas);
  };
  // Enter sobre una casilla confirma; sobre un botón conserva su propia acción (Cancelar, Confirmar).
  const alPulsar = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key !== 'Enter' || e.target instanceof HTMLButtonElement) return;
    e.preventDefault();
    confirmar();
  };

  const descripcion = (a: AccionAsesor): { readonly titulo: string; readonly detalle: string } => {
    if (a.tipo === 'DESPACHAR') {
      const recurso = snapshot.recursos.find((r) => r.id === a.idRecurso);
      const unidad = recomendacion.unidades.find((u) => u.idRecurso === a.idRecurso);
      return {
        titulo: t('plan.despachar', { unidad: recurso?.indicativo ?? a.idRecurso }),
        detalle: t('plan.despachar.detalle', {
          tipo: recurso ? textoTipoRecurso(t, recurso.tipo) : '—',
          rol: unidad?.rol ?? '—',
          min: unidad?.etaMin ?? 0,
        }),
      };
    }
    if (a.tipo === 'REFUGIO') {
      return { titulo: t('plan.refugio', { nombre: snapshot.refugios.find((r) => r.id === a.idRefugio)?.nombre ?? a.idRefugio }), detalle: t('plan.refugio.detalle') };
    }
    const { CALIENTE, TIBIA, EVACUACION } = recomendacion.perimetroSugerido;
    return { titulo: t('plan.perimetro', { caliente: CALIENTE, tibia: TIBIA, evacuacion: EVACUACION }), detalle: t('plan.perimetro.detalle') };
  };

  const titulo = t('plan.titulo', { codigo: snapshot.incidente.codigo });
  return (
    <section
      ref={raiz}
      role="dialog"
      aria-modal="false"
      aria-label={titulo}
      onKeyDown={alPulsar}
      className="flex h-full min-h-0 flex-col border-l border-border-strong bg-surface-panel shadow-overlay"
    >
      <SectionHeader title={titulo} count={`${marcadas.size}/${acciones.length}`} />
      <p className="px-4 pb-2 font-ui text-body-sm text-text-secondary">{t('plan.ayuda')}</p>

      <fieldset className="min-h-0 flex-1 overflow-y-auto border-0 p-0">
        <legend className="px-4 pb-1 font-mono text-overline uppercase text-text-muted">{t('plan.acciones')}</legend>
        <ul>
          {acciones.map((a) => {
            const clave = claveAccion(a);
            const marcada = marcadas.has(clave);
            const { titulo: texto, detalle } = descripcion(a);
            return (
              <li key={clave}>
                <label
                  className={`flex min-h-row cursor-pointer items-start gap-3 border-b border-border-subtle px-4 py-2 hover:bg-surface-hover focus-within:shadow-focus ${marcada ? 'bg-surface-selected' : ''}`}
                >
                  <input type="checkbox" checked={marcada} onChange={() => alternar(clave)} className="sr-only" />
                  <span className="mt-1 shrink-0">
                    <Glyph shape={marcada ? 'circle' : 'ring'} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-mono text-data-md font-bold text-text-primary">{texto}</span>
                    <span className="block font-ui text-body-sm text-text-secondary">{detalle}</span>
                  </span>
                  <span className="ml-auto shrink-0 font-mono text-overline uppercase text-text-muted">
                    {marcada ? t('plan.marcada') : t('plan.rechazada')}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-strong px-4 py-3">
        <Button variant="ghost" aria-keyshortcuts="Escape" onClick={onCancelar}>
          {t('plan.cancelar')} <Kbd>Esc</Kbd>
        </Button>
        <Button variant="primary" aria-keyshortcuts="Enter" disabled={marcadas.size === 0} onClick={confirmar}>
          {t('plan.confirmar', { n: marcadas.size, total: acciones.length })} <Kbd>Enter</Kbd>
        </Button>
      </div>
    </section>
  );
}
