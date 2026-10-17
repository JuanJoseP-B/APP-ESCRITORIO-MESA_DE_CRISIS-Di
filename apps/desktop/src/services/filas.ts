import {
  ESTADOS_RECURSO,
  ORIGENES_EVENTO_RECURSO,
  type CanalLlamada,
  type EstadoRecurso,
  type EstadoValidacion,
  type EventoRecurso,
  type Llamada,
  type NuevaLlamada,
  type OrigenEventoRecurso,
  type Prioridad,
  type TipoEmergencia,
} from '@argos/shared';

/** Fila tal como la devuelve PostgREST o Realtime. */
export type Fila = Record<string, unknown>;

const texto = (valor: unknown): string | null => (typeof valor === 'string' ? valor : null);

/** Fila de `llamadas` (0005) a `Llamada`: `lat`/`lng` pasan a `ubicacion` y las claves a camelCase. */
export function aLlamada(fila: Fila): Llamada {
  return {
    id: String(fila['id']),
    canal: fila['canal'] as CanalLlamada,
    tipo: fila['tipo'] as TipoEmergencia,
    prioridad: fila['prioridad'] as Prioridad,
    ubicacion: { lat: Number(fila['lat']), lng: Number(fila['lng']) },
    narrativa: texto(fila['narrativa']) ?? '',
    reportante: texto(fila['reportante']),
    callback: texto(fila['callback']),
    incidenteId: texto(fila['incidente_id']),
    estadoValidacion: fila['estado_validacion'] as EstadoValidacion,
    operadorId: texto(fila['operador_id']),
    creadoEn: texto(fila['creado_en']) ?? '',
  };
}

/** Fila a insertar en `llamadas`. Queda "No confirmado" salvo que ya se vincule a un incidente. */
export function aFilaLlamada(nueva: NuevaLlamada, incidenteId: string | null = null): Fila {
  return {
    canal: nueva.canal,
    tipo: nueva.tipo,
    prioridad: nueva.prioridad,
    lat: nueva.ubicacion.lat,
    lng: nueva.ubicacion.lng,
    narrativa: nueva.narrativa,
    reportante: nueva.reportante,
    callback: nueva.callback,
    incidente_id: incidenteId,
    estado_validacion: incidenteId ? 'Confirmado' : 'No confirmado',
  };
}

const estadoRecurso = (valor: unknown): EstadoRecurso =>
  (ESTADOS_RECURSO as readonly unknown[]).includes(valor) ? (valor as EstadoRecurso) : 'INOPERATIVO';

const origenEvento = (valor: unknown): OrigenEventoRecurso =>
  (ORIGENES_EVENTO_RECURSO as readonly unknown[]).includes(valor) ? (valor as OrigenEventoRecurso) : 'SISTEMA';

/** Fila de `eventos_recurso` (0006) a `EventoRecurso`. */
export function aEventoRecurso(fila: Fila): EventoRecurso {
  return {
    id: String(fila['id']),
    recursoId: String(fila['recurso_id']),
    incidenteId: texto(fila['incidente_id']),
    desde: estadoRecurso(fila['desde']),
    hacia: estadoRecurso(fila['hacia']),
    origen: origenEvento(fila['origen']),
    creadoEn: texto(fila['creado_en']) ?? '',
  };
}
