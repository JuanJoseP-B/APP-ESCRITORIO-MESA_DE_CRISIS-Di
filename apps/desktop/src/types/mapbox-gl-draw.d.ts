/**
 * Tipos mínimos de `@mapbox/mapbox-gl-draw` (el paquete no los publica y `@types/…` arrastra `mapbox-gl`).
 * Solo se declara la parte de la API que usa la Mesa de Crisis.
 */
declare module '@mapbox/mapbox-gl-draw' {
  import type { IControl } from 'maplibre-gl';

  export type ModoDibujo = 'draw_polygon' | 'draw_line_string' | 'simple_select';

  export interface FeatureDibujada {
    readonly id?: string | number;
    readonly type: 'Feature';
    readonly geometry: { readonly type: string; readonly coordinates: unknown };
  }

  export interface EventoCrear {
    readonly features: readonly FeatureDibujada[];
  }

  export interface EventoCambioModo {
    readonly mode: string;
  }

  export interface OpcionesDibujo {
    readonly displayControlsDefault?: boolean;
    readonly defaultMode?: ModoDibujo;
  }

  export default class MapboxDraw implements IControl {
    constructor(opciones?: OpcionesDibujo);
    onAdd(mapa: import('maplibre-gl').Map): HTMLElement;
    onRemove(mapa: import('maplibre-gl').Map): void;
    changeMode(modo: ModoDibujo): this;
    getMode(): string;
    deleteAll(): this;
    static constants: { classes: Record<string, string> };
  }
}
