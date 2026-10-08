import { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANALES_LLAMADA,
  ETIQUETAS_CANAL_LLAMADA,
  ETIQUETAS_TIPO_EMERGENCIA,
  PRIORIDADES,
  TIPOS_EMERGENCIA,
  esPrioridad,
  esTipoEmergencia,
  type Coordenadas,
  type NuevaLlamada,
} from '@argos/shared';
import { Button, Glyph, SectionHeader, SelectField, TextAreaField, TextField } from '@argos/ui';
import {
  aNuevaLlamada,
  esCanal,
  primerCampoVacio,
  textoCoordenada,
  ubicacionDe,
  validarBorrador,
  type Borrador,
  type CampoBorrador,
} from '../domain/llamadas';
import { useAtajos } from '../hooks/useAtajos';

export interface FormularioLlamadaProps {
  /** Datos de partida: vacíos (F2) o los de la llamada entrante. Para cambiar de llamada, remonta con `key`. */
  readonly inicial: Borrador;
  /** `true` si el formulario se abrió desde una llamada entrante. */
  readonly entrante: boolean;
  /** Ubicación fijada fuera del formulario (clic en el mapa); cada valor nuevo reemplaza las coordenadas. */
  readonly ubicacion: Coordenadas | null;
  /** Avisa de la ubicación escrita a mano (`null` mientras esté incompleta) para pintarla en el mapa. */
  readonly onUbicacionCambia: (ubicacion: Coordenadas | null) => void;
  readonly onCerrar: () => void;
  /** Resuelve `true` si el incidente quedó creado; entonces el formulario se cierra solo. */
  readonly onCrearIncidente: (datos: NuevaLlamada) => Promise<boolean>;
}

const OPCIONES_CANAL = CANALES_LLAMADA.map((value) => ({ value, label: ETIQUETAS_CANAL_LLAMADA[value] }));
const OPCIONES_TIPO = TIPOS_EMERGENCIA.map((value) => ({ value, label: ETIQUETAS_TIPO_EMERGENCIA[value] }));
const OPCIONES_PRIORIDAD = PRIORIDADES.map((value) => ({ value, label: value }));

const mismaUbicacion = (a: Coordenadas, b: Coordenadas): boolean => Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;

/** Drawer de registro de llamada sobre el panel de detalle. F2 lo abre, Esc lo cierra y Ctrl+Enter confirma. */
export function FormularioLlamada({ inicial, entrante, ubicacion, onUbicacionCambia, onCerrar, onCrearIncidente }: FormularioLlamadaProps) {
  const [borrador, setBorrador] = useState<Borrador>(inicial);
  const [intentado, setIntentado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const raiz = useRef<HTMLElement>(null);
  const enCurso = useRef(false);
  const montado = useRef(true);
  useEffect(() => {
    montado.current = true;
    return () => {
      montado.current = false;
    };
  }, []);

  const enfocar = useCallback((campo: CampoBorrador) => {
    raiz.current?.querySelector<HTMLElement>(`[name="${campo}"]`)?.focus();
  }, []);

  // Foco inicial en el primer campo vacío (o en el primero si ya está todo); solo al abrir.
  useEffect(() => {
    enfocar(primerCampoVacio(inicial) ?? 'canal');
  }, []);

  // El clic en el mapa llega como `ubicacion`; lo que el operador está escribiendo no se pisa si ya coincide.
  useEffect(() => {
    if (ubicacion === null) return;
    setBorrador((b) => {
      const actual = ubicacionDe(b);
      if (actual !== null && mismaUbicacion(actual, ubicacion)) return b;
      return { ...b, lat: textoCoordenada(ubicacion.lat), lng: textoCoordenada(ubicacion.lng) };
    });
  }, [ubicacion]);

  const cambiar = (campo: CampoBorrador, valor: string) => {
    const siguiente = { ...borrador, [campo]: valor } as Borrador;
    setBorrador(siguiente);
    if (campo === 'lat' || campo === 'lng') onUbicacionCambia(ubicacionDe(siguiente));
  };

  const errores = intentado ? validarBorrador(borrador) : {};

  const confirmar = async () => {
    if (enCurso.current) return;
    setIntentado(true);
    const pendientes = validarBorrador(borrador);
    const primero = Object.keys(pendientes)[0] as CampoBorrador | undefined;
    const datos = aNuevaLlamada(borrador);
    if (primero || datos === null) {
      enfocar(primero ?? 'canal');
      return;
    }
    enCurso.current = true;
    setEnviando(true);
    try {
      if (await onCrearIncidente(datos)) onCerrar();
    } finally {
      enCurso.current = false;
      if (montado.current) setEnviando(false);
    }
  };

  useAtajos({ Escape: onCerrar, 'Ctrl+Enter': () => void confirmar() });

  return (
    <section
      ref={raiz}
      role="dialog"
      aria-modal="false"
      aria-label="Registro de llamada"
      className="flex h-full min-h-0 flex-col border-l border-border-strong bg-surface-panel shadow-overlay"
    >
      <SectionHeader title="Registro de llamada" count={entrante ? 'Entrante' : 'Manual'} />
      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            size="md"
            label="Canal"
            name="canal"
            placeholder="Elige"
            options={OPCIONES_CANAL}
            value={borrador.canal}
            error={errores.canal}
            onChange={(e) => cambiar('canal', esCanal(e.target.value) ? e.target.value : '')}
          />
          <SelectField
            size="md"
            label="Prioridad"
            name="prioridad"
            placeholder="Elige"
            options={OPCIONES_PRIORIDAD}
            value={borrador.prioridad}
            error={errores.prioridad}
            onChange={(e) => cambiar('prioridad', esPrioridad(e.target.value) ? e.target.value : '')}
          />
        </div>
        <SelectField
          size="md"
          label="Tipo de emergencia"
          name="tipo"
          placeholder="Elige"
          options={OPCIONES_TIPO}
          value={borrador.tipo}
          error={errores.tipo}
          onChange={(e) => cambiar('tipo', esTipoEmergencia(e.target.value) ? e.target.value : '')}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField size="md" label="Reportante" name="reportante" value={borrador.reportante} onChange={(e) => cambiar('reportante', e.target.value)} />
          <TextField size="md" mono label="Callback" name="callback" inputMode="tel" value={borrador.callback} onChange={(e) => cambiar('callback', e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <TextField size="md" mono label="Latitud" name="lat" inputMode="decimal" value={borrador.lat} error={errores.lat} onChange={(e) => cambiar('lat', e.target.value)} />
            <TextField size="md" mono label="Longitud" name="lng" inputMode="decimal" value={borrador.lng} error={errores.lng} onChange={(e) => cambiar('lng', e.target.value)} />
          </div>
          <p className="flex items-center gap-2 font-ui text-body-sm text-text-secondary">
            <Glyph shape="diamond" />
            Haz clic en el mapa para fijar la ubicación.
          </p>
        </div>
        <TextAreaField label="Narrativa" name="narrativa" rows={4} value={borrador.narrativa} onChange={(e) => cambiar('narrativa', e.target.value)} />
      </form>
      <div className="flex shrink-0 items-center justify-end gap-2 border-t border-border-strong px-4 py-3">
        <Button variant="ghost" onClick={onCerrar}>
          Cancelar <kbd className="font-mono text-overline">Esc</kbd>
        </Button>
        <Button variant="primary" disabled={enviando} onClick={() => void confirmar()}>
          Crear incidente <kbd className="font-mono text-overline">Ctrl+Enter</kbd>
        </Button>
      </div>
    </section>
  );
}
