import { useEffect, useState } from 'react';
import { useTexto } from '../i18n/IdiomaProvider';
import { ESPERA_DESHACER_MS } from '../hooks/useDescarteDiferido';

export interface AvisoDeshacerProps {
  /** Texto del aviso, p. ej. «Llamada descartada». */
  readonly mensaje: string;
  readonly onDeshacer: () => void;
  /** Cambia con cada descarte: reinicia la cuenta atrás. */
  readonly clave: string;
}

/** Aviso flotante sobre el tablero: «Llamada descartada · Deshacer (5 s)», con una barra que se vacía. */
export function AvisoDeshacer({ mensaje, onDeshacer, clave }: AvisoDeshacerProps) {
  const { t } = useTexto();
  const total = Math.round(ESPERA_DESHACER_MS / 1000);
  const [restantes, setRestantes] = useState(total);
  useEffect(() => {
    setRestantes(total);
    const inicio = Date.now();
    const id = setInterval(() => setRestantes(Math.max(0, total - Math.floor((Date.now() - inicio) / 1000))), 250);
    return () => clearInterval(id);
  }, [clave, total]);

  return (
    <div role="status" className="ag-isla ag-aviso-deshacer" key={clave}>
      <span className="text-[13px]">{mensaje}</span>
      <span aria-hidden="true" className="text-[var(--isla-texto-3)]">·</span>
      <button type="button" className="ag-aviso-deshacer__boton" onClick={onDeshacer}>
        {t('deshacer.boton', { s: restantes })}
      </button>
      <span aria-hidden="true" className="ag-aviso-deshacer__barra" style={{ animationDuration: `${ESPERA_DESHACER_MS}ms` }} />
    </div>
  );
}
