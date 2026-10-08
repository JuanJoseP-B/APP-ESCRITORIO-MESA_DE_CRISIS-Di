import { ESCENARIOS, type IdEscenario } from '../domain/escenario';
import { crearRelojSimulado } from '../domain/relojSimulado';
import { crearServicioDemo } from '../services/servicioDemo';
import type { EntornoDemo } from '../services/entornoDemo';

/** Solo para pruebas: el demo con su semilla fija (un incidente en curso y unidades ocupadas) en vez de un escenario limpio. */
export function crearEntornoSemilla(id: IdEscenario = 'A'): EntornoDemo {
  const reloj = crearRelojSimulado();
  return { servicio: crearServicioDemo({ ahora: reloj.ahora }), reloj, escenario: ESCENARIOS[id] };
}
