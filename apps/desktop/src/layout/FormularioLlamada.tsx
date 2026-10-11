import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CANALES_LLAMADA,
  PRIORIDADES,
  TIPOS_EMERGENCIA,
  esPrioridad,
  esTipoEmergencia,
  type CandidatoDuplicado,
  type Coordenadas,
  type Incidente,
  type NuevaLlamada,
} from '@argos/shared';
import { Button, Glyph, Kbd, SectionHeader, SelectField, TextAreaField, TextField } from '@argos/ui';
import {
  aNuevaLlamada,
  esCanal,
  primerCampoVacio,
  textoCoordenada,
  ubicacionDe,
  validarBorrador,
  type Borrador,
  type CampoBorrador,
  type ErroresBorrador,
} from '../domain/llamadas';
import { buscarDuplicados } from '../domain/duplicados';
import { useAtajos } from '../hooks/useAtajos';
import { useCapaEscape } from '../hooks/useCapaEscape';
import { textoCanal, textoTipoEmergencia } from '../i18n/etiquetas';
import { useTexto } from '../i18n/IdiomaProvider';
import { AvisoDuplicado } from './AvisoDuplicado';

export interface FormularioLlamadaProps {
  /** Datos de partida: vacíos (F2) o los de la llamada entrante. Para cambiar de llamada, remonta con `key`. */
  readonly inicial: Borrador;
  /** `true` si el formulario se abrió desde una llamada entrante. */
  readonly entrante: boolean;
  /** Ubicación fijada fuera del formulario (clic en el mapa); cada valor nuevo reemplaza las coordenadas. */
  readonly ubicacion: Coordenadas | null;
  /** Avisa de la ubicación escrita a mano (`null` mientras esté incompleta) para pintarla en el mapa. */
  readonly onUbicacionCambia: (ubicacion: Coordenadas | null) => void;
  /** Incidentes con los que se compara la llamada para avisar de posibles duplicados. */
  readonly incidentes: readonly Incidente[];
  /** Hora de la consola (ms epoch): fija cuántos minutos hace que se abrió cada candidato. */
  readonly ahora: number;
  readonly onCerrar: () => void;
  /**
   * Resuelve `true` si el incidente quedó creado; entonces el formulario se cierra solo. `descartados` son los
   * candidatos que el operador vio y rechazó al crear uno nuevo.
   */
  readonly onCrearIncidente: (datos: NuevaLlamada, descartados: readonly CandidatoDuplicado[]) => Promise<boolean>;
  /** Asocia la llamada a un incidente ya abierto. Resuelve `true` si quedó vinculada. */
  readonly onVincular: (datos: NuevaLlamada, candidato: CandidatoDuplicado) => Promise<boolean>;
  /** Incidente candidato bajo el cursor o el foco, para resaltarlo en el mapa; `null` al salir. */
  readonly onResaltarIncidente: (incidenteId: string | null) => void;
}

const OPCIONES_PRIORIDAD = PRIORIDADES.map((value) => ({ value, label: value }));

const mismaUbicacion = (a: Coordenadas, b: Coordenadas): boolean => Math.abs(a.lat - b.lat) < 1e-9 && Math.abs(a.lng - b.lng) < 1e-9;

/** Drawer de registro de llamada sobre el panel de detalle. F2 lo abre, Esc lo cierra y Ctrl+Enter confirma. */
export function FormularioLlamada({
  inicial,
  entrante,
  ubicacion,
  onUbicacionCambia,
  incidentes,
  ahora,
  onCerrar,
  onCrearIncidente,
  onVincular,
  onResaltarIncidente,
}: FormularioLlamadaProps) {
  const { t } = useTexto();
  const opcionesCanal = CANALES_LLAMADA.map((value) => ({ value, label: textoCanal(t, value) }));
  const opcionesTipo = TIPOS_EMERGENCIA.map((value) => ({ value, label: textoTipoEmergencia(t, value) }));
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

  const validados = intentado ? validarBorrador(borrador) : {};
  // El dominio valida y el formulario redacta: cada campo tiene un único error posible.
  const errores: ErroresBorrador = {
    canal: validados.canal && t('llamada.error.canal'),
    tipo: validados.tipo && t('llamada.error.tipo'),
    prioridad: validados.prioridad && t('llamada.error.prioridad'),
    lat: validados.lat && t('llamada.error.lat'),
    lng: validados.lng && t('llamada.error.lng'),
  };

  // Se reevalúa al cambiar el tipo o la ubicación, y cada segundo con el reloj (los minutos del candidato).
  const { tipo, lat, lng } = borrador;
  const candidatos = useMemo(() => {
    const donde = ubicacionDe({ lat, lng });
    return tipo === '' || donde === null ? [] : buscarDuplicados({ tipo, ubicacion: donde }, incidentes, ahora);
  }, [tipo, lat, lng, incidentes, ahora]);

  /** Valida el borrador y, si está completo, ejecuta la decisión del operador; cierra el drawer si se guardó. */
  const decidir = async (accion: (datos: NuevaLlamada) => Promise<boolean>, antes?: () => boolean) => {
    if (enCurso.current) return;
    setIntentado(true);
    const primero = Object.keys(validarBorrador(borrador))[0] as CampoBorrador | undefined;
    const datos = aNuevaLlamada(borrador);
    if (primero || datos === null) {
      enfocar(primero ?? 'canal');
      return;
    }
    if (antes && !antes()) return;
    enCurso.current = true;
    setEnviando(true);
    try {
      if (await accion(datos)) onCerrar();
    } finally {
      enCurso.current = false;
      if (montado.current) setEnviando(false);
    }
  };

  const crearIncidente = (antes?: () => boolean) => decidir((datos) => onCrearIncidente(datos, candidatos), antes);
  const vincular = (candidato: CandidatoDuplicado) => decidir((datos) => onVincular(datos, candidato));

  // Con posibles duplicados Ctrl+Enter no decide por el operador: lleva el foco a VINCULAR.
  const confirmarConAtajo = () =>
    crearIncidente(() => {
      if (candidatos.length === 0) return true;
      raiz.current?.querySelector<HTMLElement>('[data-candidato] button')?.focus();
      return false;
    });

  useCapaEscape(onCerrar);
  useAtajos({ 'Ctrl+Enter': () => void confirmarConAtajo() });

  return (
    <section
      ref={raiz}
      role="dialog"
      aria-modal="false" data-tutorial="formulario"
      aria-label={t('llamada.titulo')}
      className="flex h-full min-h-0 flex-col border-l border-border-strong bg-surface-panel shadow-overlay"
    >
      <SectionHeader title={t('llamada.titulo')} count={entrante ? t('llamada.entrante') : t('llamada.manual')} />
      <form
        noValidate
        onSubmit={(e) => e.preventDefault()}
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4"
      >
        <AvisoDuplicado candidatos={candidatos} onVincular={(c) => void vincular(c)} onResaltar={onResaltarIncidente} deshabilitado={enviando} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            size="md"
            label={t('llamada.canal')}
            name="canal"
            placeholder={t('llamada.elige')}
            options={opcionesCanal}
            value={borrador.canal}
            error={errores.canal}
            onChange={(e) => cambiar('canal', esCanal(e.target.value) ? e.target.value : '')}
          />
          <SelectField
            size="md"
            label={t('llamada.prioridad')}
            name="prioridad"
            placeholder={t('llamada.elige')}
            options={OPCIONES_PRIORIDAD}
            value={borrador.prioridad}
            error={errores.prioridad}
            onChange={(e) => cambiar('prioridad', esPrioridad(e.target.value) ? e.target.value : '')}
          />
        </div>
        <SelectField
          size="md"
          label={t('llamada.tipo')}
          name="tipo"
          placeholder={t('llamada.elige')}
          options={opcionesTipo}
          value={borrador.tipo}
          error={errores.tipo}
          onChange={(e) => cambiar('tipo', esTipoEmergencia(e.target.value) ? e.target.value : '')}
        />
        <div className="grid grid-cols-2 gap-3">
          <TextField size="md" label={t('llamada.reportante')} name="reportante" value={borrador.reportante} onChange={(e) => cambiar('reportante', e.target.value)} />
          <TextField size="md" mono label={t('llamada.callback')} name="callback" inputMode="tel" value={borrador.callback} onChange={(e) => cambiar('callback', e.target.value)} />
        </div>
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-3">
            <TextField size="md" mono label={t('llamada.lat')} name="lat" inputMode="decimal" value={borrador.lat} error={errores.lat} onChange={(e) => cambiar('lat', e.target.value)} />
            <TextField size="md" mono label={t('llamada.lng')} name="lng" inputMode="decimal" value={borrador.lng} error={errores.lng} onChange={(e) => cambiar('lng', e.target.value)} />
          </div>
          <p className="flex items-center gap-2 font-ui text-body-sm text-text-secondary">
            <Glyph shape="diamond" />
            {t('llamada.pistaMapa')}
          </p>
        </div>
        <TextAreaField label={t('llamada.narrativa')} name="narrativa" rows={4} value={borrador.narrativa} onChange={(e) => cambiar('narrativa', e.target.value)} />
      </form>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border-strong px-4 py-3">
        <Button variant="ghost" aria-keyshortcuts="Escape" onClick={onCerrar}>
          {t('llamada.cancelar')} <Kbd>Esc</Kbd>
        </Button>
        <Button variant="primary" aria-keyshortcuts="Control+Enter" disabled={enviando} onClick={() => void crearIncidente()}>
          {t('llamada.crear')} <Kbd>Ctrl+Enter</Kbd>
        </Button>
      </div>
    </section>
  );
}
