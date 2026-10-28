import { ESCENARIOS, type Escenario, type IdEscenario } from '../domain/escenario';
import { crearRelojSimulado, type RelojSimulado } from '../domain/relojSimulado';
import { crearServicioDemo, type SesionDemo } from './servicioDemo';
import type { ServicioMesa } from './supabaseClient';

/** Servicio demo con su reloj simulado y el escenario que lo alimenta: la consola y los datos comparten la misma hora. */
export interface EntornoDemo {
  readonly servicio: ServicioMesa;
  readonly reloj: RelojSimulado;
  readonly escenario: Escenario;
}

/** Entorno limpio del escenario `id`: unidades libres en su base, sin incidentes ni llamadas, reloj en pausa. */
export function crearEntornoDemo(id: IdEscenario, sesion?: SesionDemo): EntornoDemo {
  const escenario = ESCENARIOS[id];
  const reloj = crearRelojSimulado();
  return { servicio: crearServicioDemo({ ahora: reloj.ahora, escenario, sesion }), reloj, escenario };
}

/** Sesión común a todos los entornos con login: cambiar o reiniciar el escenario no la cierra. */
const sesionConLogin: SesionDemo = { activa: false };

/** Como `crearEntornoDemo`, pero la consola arranca en la pantalla de acceso (la app real del demo). */
export function crearEntornoDemoConLogin(id: IdEscenario): EntornoDemo {
  return crearEntornoDemo(id, sesionConLogin);
}
