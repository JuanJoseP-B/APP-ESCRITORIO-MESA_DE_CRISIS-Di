import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Coachmark } from '@argos/ui';
import {
  PASOS_TUTORIAL,
  type AccionTutorial,
  type EstadoTutorial,
  estadoInicialTutorial,
  guardarTutorialVisto,
  leerTutorialVisto,
  reducirTutorial,
} from '../domain/tutorial';
import { useTexto } from '../i18n/IdiomaProvider';

/** Lo que la consola pone a disposición del recorrido para cumplir los requisitos de cada paso. */
export interface PreparacionTutorial {
  expandirCola(): void;
  expandirDetalle(): void;
  /** Selecciona el primer incidente activo si no hay ninguno seleccionado. */
  seleccionarPrimero(): void;
  cerrarFormulario(): void;
}

/** Control del reloj del demo; el recorrido lo pausa mientras dura. */
export interface SimulacionPausable {
  readonly reproduciendo: boolean;
  alternar(): void;
}

export interface ControlTutorial {
  readonly activo: boolean;
  /** Ya se vio o se descartó alguna vez. */
  readonly visto: boolean;
  iniciar(): void;
  /** «Ahora no» en la invitación del primer arranque. */
  descartarInvitacion(): void;
}

const Contexto = createContext<ControlTutorial | null>(null);

/** Control del tutorial, o `null` fuera de un `TutorialProvider` (los accesos al recorrido no se ofrecen). */
export function useTutorial(): ControlTutorial | null {
  return useContext(Contexto);
}

const REBUSCAR_ANCLA_MS = 250;

const reductor = (estado: EstadoTutorial, accion: AccionTutorial): EstadoTutorial => reducirTutorial(estado, accion);

export interface TutorialProviderProps {
  readonly preparacion: PreparacionTutorial;
  /** Solo en modo demo. */
  readonly simulacion?: SimulacionPausable | null;
  readonly reducirMovimiento?: boolean;
  readonly children: ReactNode;
}

/**
 * Recorrido guiado sobre la consola real. Antes de cada paso cumple lo que pide (paneles abiertos, incidente
 * seleccionado), resalta el elemento `data-tutorial` del paso —si no está en pantalla, lo muestra centrado— y
 * pausa la simulación del demo mientras dura, reanudándola al salir si estaba corriendo.
 */
export function TutorialProvider({ preparacion, simulacion, reducirMovimiento = false, children }: TutorialProviderProps) {
  const { t } = useTexto();
  const [estado, despachar] = useReducer(reductor, undefined, () => estadoInicialTutorial(leerTutorialVisto()));
  const { activo, visto } = estado;
  const paso = activo ? (PASOS_TUTORIAL[estado.indice] ?? null) : null;

  // La consola cambia de callbacks en cada render: el recorrido los lee desde refs.
  const prep = useRef(preparacion);
  prep.current = preparacion;
  const simu = useRef(simulacion);
  simu.current = simulacion;
  const abrioFormulario = useRef(false);
  const abridor = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (visto) guardarTutorialVisto();
  }, [visto]);

  // Requisitos del paso. El formulario que abrió el paso interactivo se cierra al salir de los pasos que lo muestran.
  useEffect(() => {
    const p = prep.current;
    if (paso?.requiere === 'panelIzquierdo') p.expandirCola();
    else if (paso?.requiere === 'panelDerecho') p.expandirDetalle();
    else if (paso?.requiere === 'incidenteSeleccionado') {
      p.seleccionarPrimero();
      p.expandirDetalle();
    }
    if (paso?.ancla !== 'formulario' && abrioFormulario.current) {
      abrioFormulario.current = false;
      p.cerrarFormulario();
    }
  }, [paso]);

  // Paso interactivo: la consola atiende la tecla y el recorrido avanza solo.
  useEffect(() => {
    const esperada = paso?.accionEsperada;
    if (!esperada) return;
    const alPulsar = (e: KeyboardEvent) => {
      if (e.key !== esperada) return;
      abrioFormulario.current = true;
      despachar({ tipo: 'siguiente' });
    };
    document.addEventListener('keydown', alPulsar);
    return () => document.removeEventListener('keydown', alPulsar);
  }, [paso]);

  // El escenario no corre mientras se explica la consola; al salir vuelve a como estaba.
  const pausadaPorTutorial = useRef(false);
  useEffect(() => {
    if (!activo) return;
    const simulacionActual = simu.current;
    if (simulacionActual?.reproduciendo) {
      simulacionActual.alternar();
      pausadaPorTutorial.current = true;
    }
    return () => {
      const actual = simu.current;
      if (pausadaPorTutorial.current && actual && !actual.reproduciendo) actual.alternar();
      pausadaPorTutorial.current = false;
      if (abridor.current?.isConnected) abridor.current.focus();
      abridor.current = null;
    };
  }, [activo]);

  // El ancla puede aparecer un instante después (un panel que se despliega): se vuelve a buscar mientras dura el paso.
  const nombreAncla = paso?.ancla ?? null;
  const [ancla, setAncla] = useState<HTMLElement | null>(null);
  useLayoutEffect(() => {
    if (!nombreAncla) {
      setAncla(null);
      return;
    }
    const buscar = () => setAncla(document.querySelector<HTMLElement>(`[data-tutorial="${nombreAncla}"]`));
    buscar();
    const id = setInterval(buscar, REBUSCAR_ANCLA_MS);
    return () => clearInterval(id);
  }, [nombreAncla]);

  const iniciar = useCallback(() => {
    abridor.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    despachar({ tipo: 'iniciar' });
  }, []);
  const descartarInvitacion = useCallback(() => despachar({ tipo: 'descartarInvitacion' }), []);
  const control = useMemo<ControlTutorial>(() => ({ activo, visto, iniciar, descartarInvitacion }), [activo, visto, iniciar, descartarInvitacion]);

  const textos = paso?.clavesTexto;
  return (
    <Contexto.Provider value={control}>
      {children}
      {paso && textos && (
        <Coachmark
          ancla={ancla}
          titulo={t(textos.titulo)}
          texto={t(textos.cuerpo)}
          pista={textos.pista ? t(textos.pista) : undefined}
          indice={estado.indice}
          total={PASOS_TUTORIAL.length}
          colocacion={paso.colocacion}
          teclaLibre={paso.accionEsperada}
          reducirMovimiento={reducirMovimiento}
          etiquetas={{
            dialogo: t('tutorial.aria'),
            progreso: t('tutorial.progreso', { n: estado.indice + 1, total: PASOS_TUTORIAL.length }),
            anterior: t('tutorial.anterior'),
            siguiente: t('tutorial.siguiente'),
            finalizar: t('tutorial.finalizar'),
            saltar: t('tutorial.saltar'),
            teclas: t('tutorial.teclas'),
          }}
          onAnterior={() => despachar({ tipo: 'anterior' })}
          onSiguiente={() => despachar({ tipo: 'siguiente' })}
          onSaltar={() => despachar({ tipo: 'saltar' })}
        />
      )}
    </Contexto.Provider>
  );
}
