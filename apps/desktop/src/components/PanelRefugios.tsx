import { ajustarOcupacion, type ZonaPublica } from '@argos/shared';

interface Props {
  readonly zonas: readonly ZonaPublica[];
  readonly onCambiarOcupacion: (zona: ZonaPublica, nuevaOcupacion: number) => void;
}

const PASO = 5;

export function PanelRefugios({ zonas, onCambiarOcupacion }: Props) {
  const refugios = zonas.filter((z) => z.tipo === 'Refugio');
  if (refugios.length === 0) return null;
  const boton = 'border border-linea px-2 py-0.5 font-mono text-xs hover:border-texto disabled:opacity-40';

  return (
    <section aria-label="Refugios" className="border-t border-linea px-3 py-2">
      <h2 className="font-mono text-xs font-bold uppercase">Refugios</h2>
      <ul className="mt-1 space-y-1">
        {refugios.map((z) => (
          <li key={z.id} className="flex items-center gap-2 text-sm">
            <span className="flex-1 truncate">{z.nombre}</span>
            <button
              type="button"
              aria-label={`Reducir ocupación de ${z.nombre}`}
              disabled={z.capacidad_actual <= 0}
              onClick={() => onCambiarOcupacion(z, ajustarOcupacion(z, -PASO))}
              className={boton}
            >
              -{PASO}
            </button>
            <span className="w-20 text-center font-mono text-xs">
              {z.capacidad_actual}/{z.capacidad_maxima}
            </span>
            <button
              type="button"
              aria-label={`Aumentar ocupación de ${z.nombre}`}
              disabled={z.capacidad_actual >= z.capacidad_maxima}
              onClick={() => onCambiarOcupacion(z, ajustarOcupacion(z, PASO))}
              className={boton}
            >
              +{PASO}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
