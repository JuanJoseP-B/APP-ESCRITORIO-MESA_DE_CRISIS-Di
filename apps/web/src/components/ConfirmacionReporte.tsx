interface Props {
  readonly idReporte: string;
  readonly onCerrar: () => void;
}

/** Modal de confirmación tras un envío exitoso; muestra el ID para que el ciudadano pueda citarlo. */
export function ConfirmacionReporte({ idReporte, onCerrar }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-texto/60 sm:items-center">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirmacion-titulo"
        className="w-full max-w-md border-t-4 border-ok bg-superficie p-4 sm:border-t-0 sm:border-l-4"
      >
        <h2 id="confirmacion-titulo" className="text-base font-bold">
          Reporte enviado
        </h2>
        <p role="status" className="mt-1 text-sm">
          Un operador lo revisará y validará. Guarda este código de referencia:
        </p>
        <p
          data-testid="id-reporte"
          className="mt-2 break-all border border-linea bg-base p-2 font-mono text-sm font-bold"
        >
          {idReporte}
        </p>
        <button
          type="button"
          onClick={onCerrar}
          autoFocus
          className="mt-4 min-h-12 w-full bg-ok px-4 text-sm font-bold uppercase tracking-wide text-white"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}
