import { ESCENARIOS, type Escenario, type IdEscenario } from '../domain/escenario';
import { crearRelojSimulado, type RelojSimulado } from '../domain/relojSimulado';
import { crearServicioDemo } from './servicioDemo';
import type { ServicioMesa } from './supabaseClient';

/** Servicio demo con su reloj simulado y el escenario que lo alimenta: la consola y los datos comparten la misma hora. */
export interface EntornoDemo {
  readonly servicio: ServicioMesa;
  readonly reloj: RelojSimulado;
  readonly escenario: Escenario;
}

/** Entorno limpio del escenario `id`: unidades libres en su base, sin incidentes ni llamadas, reloj en pausa. */
export function crearEntornoDemo(id: IdEscenario): EntornoDemo {
  const escenario = ESCENARIOS[id];
  const reloj = crearRelojSimulado();
  return { servicio: crearServicioDemo({ ahora: reloj.ahora, escenario }), reloj, escenario };
}
