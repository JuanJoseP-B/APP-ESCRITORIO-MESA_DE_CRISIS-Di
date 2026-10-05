import type { ZonaPublica } from '@argos/shared';
import { ocupacionRefugio } from '../domain/geojson';

interface Props {
  readonly zonas: readonly ZonaPublica[];
  readonly cargando?: boolean;
  readonly error?: string | null;
}

function porcentaje(z: ZonaPublica): number {
  return z.capacidad_maxima > 0 ? Math.min(100, Math.round((z.capacidad_actual / z.capacidad_maxima) * 100)) : 0;
}

/** Refugios con su ocupación; los bloqueos de vía se listan aparte como avisos. */
export function ListaRefugios({ zonas, cargando = false, error = null }: Props) {
  const refugios = zonas.filter((z) => z.tipo === 'Refugio');
  const bloqueos = zonas.filter((z) => z.tipo === 'Bloqueo de Vía');

  return (
    <section aria-label="Refugios y rutas" className="font-sans">
      {error && (
        <p role="alert" className="border-b border-linea px-3 py-2 text-sm text-critico">
          {error}
        </p>
      )}
      {cargando && <p className="px-3 py-2 font-mono text-xs">Cargando…</p>}

      <h2 className="border-b border-linea px-3 py-2 font-mono text-xs font-bold uppercase tracking-wide">
        Refugios seguros ({refugios.length})
      </h2>
      {!cargando && refugios.length === 0 && (
        <p className="px-3 py-2 text-sm">No hay refugios publicados por ahora.</p>
      )}
      <ul>
        {refugios.map((z) => {
          const lleno = z.capacidad_actual >= z.capacidad_maxima;
          return (
            <li key={z.id} className="border-b border-linea px-3 py-2">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{z.nombre}</span>
                <span className={`font-mono text-xs ${lleno ? 'text-critico' : 'text-ok'}`}>
                  {ocupacionRefugio(z)}
                </span>
              </div>
              <div
                className="mt-1 h-1 bg-linea"
                role="progressbar"
                aria-label={`Ocupación de ${z.nombre}`}
                aria-valuenow={porcentaje(z)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className={`h-full ${lleno ? 'bg-critico' : 'bg-ok'}`} style={{ width: `${porcentaje(z)}%` }} />
              </div>
              {lleno && <span className="font-mono text-xs text-critico">COMPLETO</span>}
            </li>
          );
        })}
      </ul>

      {bloqueos.length > 0 && (
        <>
          <h2 className="border-b border-linea px-3 py-2 font-mono text-xs font-bold uppercase tracking-wide">
            Vías bloqueadas ({bloqueos.length})
          </h2>
          <ul>
            {bloqueos.map((z) => (
              <li key={z.id} className="border-b border-linea px-3 py-2 text-sm">
                <span className="mr-2 inline-block h-2 w-2 bg-advertencia" aria-hidden="true" />
                {z.nombre}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
