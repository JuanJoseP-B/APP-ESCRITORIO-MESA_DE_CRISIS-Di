import {
  CANALES_LLAMADA,
  agregarEvento,
  etiquetaTipoEmergencia,
  type CanalLlamada,
  type Coordenadas,
  type Llamada,
  type NivelCriticidad,
  type NuevaLlamada,
  type NuevoIncidente,
  type Prioridad,
  type TipoEmergencia,
} from '@argos/shared';

/** Campos del formulario en el orden en que el operador los recorre. */
export const CAMPOS_BORRADOR = ['canal', 'tipo', 'prioridad', 'reportante', 'callback', 'lat', 'lng', 'narrativa'] as const;
export type CampoBorrador = (typeof CAMPOS_BORRADOR)[number];

/** Lo que hay escrito en el formulario: todo texto, porque aún puede estar a medias. */
export interface Borrador {
  readonly canal: CanalLlamada | '';
  readonly tipo: TipoEmergencia | '';
  readonly prioridad: Prioridad | '';
  readonly reportante: string;
  readonly callback: string;
  readonly lat: string;
  readonly lng: string;
  readonly narrativa: string;
}

export const BORRADOR_VACIO: Borrador = {
  canal: '',
  tipo: '',
  prioridad: '',
  reportante: '',
  callback: '',
  lat: '',
  lng: '',
  narrativa: '',
};

/** Decimales con que se muestra una coordenada (≈ 1 m). */
const DECIMALES = 5;

export const textoCoordenada = (valor: number): string => valor.toFixed(DECIMALES);

/** Precarga el formulario con una llamada entrante. */
export function borradorDesdeLlamada(l: Llamada): Borrador {
  return {
    canal: l.canal,
    tipo: l.tipo,
    prioridad: l.prioridad,
    reportante: l.reportante ?? '',
    callback: l.callback ?? '',
    lat: textoCoordenada(l.ubicacion.lat),
    lng: textoCoordenada(l.ubicacion.lng),
    narrativa: l.narrativa,
  };
}

/** Número de un campo de coordenada (acepta coma decimal); `null` si no es un número dentro de `[-limite, limite]`. */
export function leerCoordenada(texto: string, limite: number): number | null {
  const limpio = texto.trim().replace(',', '.');
  if (limpio === '') return null;
  const valor = Number(limpio);
  return Number.isFinite(valor) && Math.abs(valor) <= limite ? valor : null;
}

/** Ubicación del borrador, o `null` si falta una coordenada o está fuera de rango. */
export function ubicacionDe(b: Pick<Borrador, 'lat' | 'lng'>): Coordenadas | null {
  const lat = leerCoordenada(b.lat, 90);
  const lng = leerCoordenada(b.lng, 180);
  return lat === null || lng === null ? null : { lat, lng };
}

/** Primer campo sin rellenar, en el orden del formulario; `null` si están todos. */
export function primerCampoVacio(b: Borrador): CampoBorrador | null {
  return CAMPOS_BORRADOR.find((campo) => b[campo].trim() === '') ?? null;
}

export type ErroresBorrador = Partial<Record<CampoBorrador, string>>;

/** Errores por campo; vacío si el borrador se puede registrar. */
export function validarBorrador(b: Borrador): ErroresBorrador {
  const errores: { -readonly [C in CampoBorrador]?: string } = {};
  if (b.canal === '') errores.canal = 'Indica por qué canal entró la llamada';
  if (b.tipo === '') errores.tipo = 'Indica el tipo de emergencia';
  if (b.prioridad === '') errores.prioridad = 'Indica la prioridad';
  if (leerCoordenada(b.lat, 90) === null) errores.lat = 'Latitud entre -90 y 90';
  if (leerCoordenada(b.lng, 180) === null) errores.lng = 'Longitud entre -180 y 180';
  return errores;
}

const textoOpcional = (valor: string): string | null => (valor.trim() === '' ? null : valor.trim());

/** Llamada lista para registrar; `null` mientras el borrador tenga errores. */
export function aNuevaLlamada(b: Borrador): NuevaLlamada | null {
  const ubicacion = ubicacionDe(b);
  const { canal, tipo, prioridad } = b;
  if (canal === '' || tipo === '' || prioridad === '' || ubicacion === null) return null;
  return {
    canal,
    tipo,
    prioridad,
    ubicacion,
    narrativa: b.narrativa.trim(),
    reportante: textoOpcional(b.reportante),
    callback: textoOpcional(b.callback),
  };
}

export const esCanal = (valor: string): valor is CanalLlamada => (CANALES_LLAMADA as readonly string[]).includes(valor);

const CRITICIDAD_POR_PRIORIDAD: Readonly<Record<Prioridad, NivelCriticidad>> = {
  P1: 'Crítico',
  P2: 'Medio',
  P3: 'Bajo',
  P4: 'Bajo',
};

const LARGO_TITULO = 48;

/** "Fuga de gas · Olor fuerte a gas en un edificio…": el tipo y el comienzo de la narrativa. */
export function tituloDeLlamada(l: Pick<NuevaLlamada, 'tipo' | 'narrativa'>): string {
  const tipo = etiquetaTipoEmergencia(l.tipo);
  const narrativa = l.narrativa.trim().replace(/\s+/g, ' ');
  if (narrativa === '') return tipo;
  return `${tipo} · ${narrativa.length > LARGO_TITULO ? `${narrativa.slice(0, LARGO_TITULO).trimEnd()}…` : narrativa}`;
}

/** Incidente nuevo en el punto de la llamada; la bitácora deja constancia de la decisión del operador. */
export function incidenteDesdeLlamada(l: NuevaLlamada, ahora: Date, operador?: string): NuevoIncidente {
  return {
    titulo: tituloDeLlamada(l),
    nivel_criticidad: CRITICIDAD_POR_PRIORIDAD[l.prioridad],
    prioridad: l.prioridad,
    tipo: l.tipo,
    estado: 'Abierto',
    geometria: { type: 'Point', coordinates: [l.ubicacion.lng, l.ubicacion.lat] },
    timeline: agregarEvento([], `Incidente creado desde llamada ${l.canal} (${l.prioridad})`, ahora, operador),
  };
}
