// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { es } from '../i18n/es';
import { en } from '../i18n/en';
import {
  CLAVE_TUTORIAL_VISTO,
  PASOS_TUTORIAL,
  estadoInicialTutorial,
  guardarTutorialVisto,
  leerTutorialVisto,
  reducirTutorial,
  type EstadoTutorial,
} from './tutorial';

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
});

const enMarcha = (indice: number): EstadoTutorial => ({ activo: true, indice, visto: false });

describe('PASOS_TUTORIAL', () => {
  it('son los 11 pasos del recorrido, con ids únicos y la bienvenida sin ancla', () => {
    expect(PASOS_TUTORIAL).toHaveLength(11);
    expect(new Set(PASOS_TUTORIAL.map((p) => p.id)).size).toBe(11);
    expect(PASOS_TUTORIAL[0]?.ancla).toBeNull();
    expect(PASOS_TUTORIAL[0]?.colocacion).toBe('centro');
    expect(PASOS_TUTORIAL.at(-1)?.id).toBe('cierre');
  });

  it('solo el registro de llamada espera una acción, y es F2', () => {
    expect(PASOS_TUTORIAL.filter((p) => p.accionEsperada).map((p) => [p.id, p.accionEsperada])).toEqual([['registro', 'F2']]);
  });

  it('los pasos de la cola y los de detalle piden el panel que los contiene', () => {
    const requisito = (id: string) => PASOS_TUTORIAL.find((p) => p.id === id)?.requiere;
    expect(requisito('entrantes')).toBe('panelIzquierdo');
    expect(requisito('cola')).toBe('panelIzquierdo');
    expect(requisito('registro')).toBe('panelDerecho');
    expect(requisito('detalle')).toBe('incidenteSeleccionado');
    expect(requisito('asesor')).toBe('incidenteSeleccionado');
  });

  it('cada paso tiene sus textos en español e inglés', () => {
    for (const { clavesTexto } of PASOS_TUTORIAL) {
      for (const clave of [clavesTexto.titulo, clavesTexto.cuerpo, ...(clavesTexto.pista ? [clavesTexto.pista] : [])]) {
        expect(es[clave].length).toBeGreaterThan(0);
        expect(en[clave].length).toBeGreaterThan(0);
      }
    }
  });
});

describe('reducirTutorial', () => {
  it('iniciar arranca en el primer paso, también al repetirlo', () => {
    expect(reducirTutorial(estadoInicialTutorial(false), { tipo: 'iniciar' })).toEqual({ activo: true, indice: 0, visto: false });
    expect(reducirTutorial({ activo: false, indice: 0, visto: true }, { tipo: 'iniciar' })).toEqual({ activo: true, indice: 0, visto: true });
    expect(reducirTutorial(enMarcha(5), { tipo: 'iniciar' }).indice).toBe(0);
  });

  it('siguiente y anterior se mueven un paso y anterior no baja de cero', () => {
    expect(reducirTutorial(enMarcha(2), { tipo: 'siguiente' }).indice).toBe(3);
    expect(reducirTutorial(enMarcha(2), { tipo: 'anterior' }).indice).toBe(1);
    expect(reducirTutorial(enMarcha(0), { tipo: 'anterior' }).indice).toBe(0);
  });

  it('siguiente en el último paso completa el recorrido', () => {
    const ultimo = PASOS_TUTORIAL.length - 1;
    expect(reducirTutorial(enMarcha(ultimo), { tipo: 'siguiente' })).toEqual({ activo: false, indice: 0, visto: true });
  });

  it('saltar y completar cierran el recorrido y lo dan por visto', () => {
    expect(reducirTutorial(enMarcha(3), { tipo: 'saltar' })).toEqual({ activo: false, indice: 0, visto: true });
    expect(reducirTutorial(enMarcha(3), { tipo: 'completar' })).toEqual({ activo: false, indice: 0, visto: true });
  });

  it('con el recorrido cerrado, siguiente, anterior, saltar y completar no hacen nada', () => {
    const cerrado = estadoInicialTutorial(false);
    for (const tipo of ['siguiente', 'anterior', 'saltar', 'completar'] as const) {
      expect(reducirTutorial(cerrado, { tipo })).toBe(cerrado);
    }
  });

  it('«Ahora no» da por visto sin abrir el recorrido', () => {
    expect(reducirTutorial(estadoInicialTutorial(false), { tipo: 'descartarInvitacion' })).toEqual({ activo: false, indice: 0, visto: true });
  });
});

describe('persistencia de tutorialVisto', () => {
  it('por defecto es falso y guardarlo lo recuerda', () => {
    expect(leerTutorialVisto()).toBe(false);
    guardarTutorialVisto();
    expect(localStorage.getItem(CLAVE_TUTORIAL_VISTO)).toBe('true');
    expect(leerTutorialVisto()).toBe(true);
  });

  it('un valor distinto de «true» cuenta como no visto', () => {
    localStorage.setItem(CLAVE_TUTORIAL_VISTO, 'quizá');
    expect(leerTutorialVisto()).toBe(false);
  });

  it('si el almacenamiento falla no lanza y cuenta como no visto', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(leerTutorialVisto()).toBe(false);
    expect(() => guardarTutorialVisto()).not.toThrow();
  });
});
