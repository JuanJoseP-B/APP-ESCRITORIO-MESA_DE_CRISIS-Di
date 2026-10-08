# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Monorepo con **npm workspaces** (`apps/*`, `packages/*`), git en `main` con remoto `origin`. **Pivote CAD (2026-10-07):** ARGOS es ahora una consola de despacho 100 % de escritorio; `ROADMAP_CAD.md` define alcance, interfaz (Zero-Scroll Tactical Grid), contratos y fases, y manda sobre `SPEC.md` si hay conflicto. El portal ciudadano `apps/web` está archivado en `archive/web/` (fuera de los workspaces; `npm run check` no lo ejecuta ni lo lintea). Hecho hasta ahora: monorepo, config TS/ESLint/Vitest, `@argos/shared`, el frontend de `apps/desktop` (servicio Supabase, MapLibre, panel Mesa de Crisis, trazado con `@mapbox/mapbox-gl-draw`, Realtime; sin credenciales usa `servicioDemo`), design system `@argos/ui`, máquina de estados de recursos, login de operador (rol en `app_metadata`), confirmar/descartar llamadas, persistencia de polígonos/estado de incidentes, panel de refugios (`useAccionesOperador`), RPC atómica `ajustar_ocupacion_zona` (migración `0004`) y `src-tauri` inicializado. **Fase 1 hecha (grilla táctica):** `apps/desktop/src/layout/` tiene `GrillaTactica` (5 áreas fijas sobre 100dvh, B y D colapsables con `[` y `]`), `BarraEstado`, `ColaIncidentes`, `PanelDetalle` (aquí vive DESPACHAR, ligado al incidente seleccionado), `TableroUnidades` y `MapaTactico` (basemap desaturado y leyenda); la lógica pura está en `src/domain/` (`cola`, `timeline`, `atajos`, `reloj`, `conexion`, `unidades`, `basemap`). Atajos activos: `[`, `]`, `J`, `K`, `Esc` (F2, D y A llegan en las Fases 2 y 3). Hasta la Fase 2 la cola ordena por criticidad, no por prioridad P1–P4. `Recurso` no tiene coordenadas, así que el mapa no pinta unidades. La migración `0005` (renombra `reportes_ciudadanos` a `llamadas` y elimina el acceso `anon`) se escribe en la Fase 1 y **no se aplica** al proyecto Supabase real hasta que el usuario lo ordene. `src/mapaWorker.ts` fija la URL del worker de MapLibre 6: sin él Vite no lo sirve y no se pinta ninguna capa GeoJSON. Pendiente: Fases 2 y 3 del roadmap CAD (lógica CAD con SLA y duplicados, Asesor IA), aplicar migraciones al proyecto real (orden en `supabase/README.md`) y despliegue.

## Comandos

Ejecutar desde la raíz:
- `npm run check`: lint + typecheck + tests. Definition of Done: debe terminar con 0 errores.
- `npm run lint` / `npm run typecheck` / `npm run test` por separado.
- Una sola prueba: `npx vitest run packages/shared/types/incidente.test.ts` (añade `-t "<nombre>"` para un caso concreto).

`typecheck` cubre `packages/shared`, `packages/ui` y `apps/desktop`; al crear una app nueva, añade su `tsc --noEmit -p apps/<app>` a ese script.

## Estructura

- `tsconfig.base.json` (estricto, `noUncheckedIndexedAccess`) lo extienden todos los paquetes/apps.
- `eslint.config.js` (flat config) impone `@typescript-eslint/no-explicit-any: error`, que es lo que hace cumplir la prohibición de `any`.
- `packages/shared` (`@argos/shared`): tipos TS puros en `types/` (exporta `index.ts`). Cada enum del SPEC es una constante `as const` (p. ej. `NIVELES_CRITICIDAD`) más su tipo derivado. `geometria` es una unión discriminada por `type` (`Point` | `Polygon`). `Recurso` no tiene `lat`/`lng` a propósito; una prueba con `expectTypeOf` lo fija. Tipos adicionales: `ZonaPublica` (refugios y bloqueos, con `nombre` y `geometria`), `ZonaRiesgo` (incidente sin `timeline`) y `NuevoReporte`. Las rutas reales son `packages/shared/types/` (no `src/`).
- `packages/ui` (`@argos/ui`): design system ARGOS Táctico (tokens CSS, puente Tailwind 4 y 11 componentes React tipados con pruebas, incluidos `UnitChip` y `RailColapsable`). Lo consume `apps/desktop`; `typecheck` ya lo cubre.
- `apps/web` ya no existe en los workspaces: vive en `archive/web/` solo como referencia histórica. No lo modifiques ni lo importes.
- Las pruebas viven junto al código (`*.test.ts`).

## Proyecto

"Mesa de Crisis": consola CAD (Computer-Aided Dispatch) de respuesta a emergencias, una única aplicación de escritorio sobre un backend Supabase:
- **Escritorio (operadores/despachadores):** Tauri 2 + React + TypeScript. Registro de llamadas (123, VHF, sensor, presencial), cola de incidentes, despacho de unidades desde el detalle del incidente, trazado de polígonos y perímetros de riesgo.
- **Común:** Tailwind CSS + design system `@argos/ui`, Mapbox GL JS / MapLibre (únicos motores de mapas permitidos), Supabase (PostgreSQL, Auth email/password con rol `operador`, Realtime por WebSockets).

## Arquitectura

Flujo: el operador registra una llamada (entra como "No confirmado") → la vincula a un incidente existente o crea uno nuevo → traza o genera el perímetro de riesgo y despacha unidades desde `PanelDetalle` → Supabase Realtime sincroniza a todos los puestos.

Tablas principales: `incidentes` (criticidad, estado, `geometria` GeoJSON, `timeline` JSONB), `llamadas` (antes `reportes_ciudadanos`), `recursos_operativos`, `zonas_publicas` y `zonas_riesgo` (espejo de `incidentes` sin `timeline`).

**Restricción de seguridad clave:** no hay acceso anónimo. Todas las tablas y el bucket `reportes` exigen `es_operador()` (rol en `app_metadata` del JWT); ninguna política puede mencionar el rol `anon`. Esto se impone con RLS y lo valida `supabase/rls.test.ts`. `recursos_operativos` no lleva coordenadas tácticas. Los secretos (p. ej. la API key del Asesor IA, Fase 3) viven solo en el backend Rust, nunca en el bundle del frontend.

## Reglas de código (obligatorias)

- **Tipos compartidos:** `packages/shared/types` exporta `Incidente`, `Recurso` y `Reporte`; la app y los paquetes los consumen (evita contratos duplicados).
- **Acceso a Supabase aislado:** todas las llamadas pasan por un servicio unificado (p. ej. `services/supabaseClient.ts`); nunca consultar desde componentes de UI.
- **Prohibido `any`** en cualquier archivo TypeScript (tipado estricto).
- **Fuera de alcance (Fase 1):** pasarelas de pago, OAuth/redes sociales (solo email/password y roles internos), gráficos 3D o motores de mapas distintos a Mapbox GL JS / MapLibre.

## Verificación y flujo de trabajo

- Cada hito lleva pruebas unitarias con **Vitest**.
- Definition of Done: `npm run check` con 0 errores (ver Comandos).
- Control de versiones: **GitFlow** y **Conventional Commits**.

## Design System · ARGOS Táctico (Neo-Editorial Táctico)

Fuente de verdad: `packages/ui` (`@argos/ui`): `src/tokens.css` (tokens en 3 capas, temas crema/carbón, fuentes en `fonts/`) → `src/theme.css` (puente Tailwind 4 `@theme inline`, reinicia paleta/radios/sombras por defecto) → `src/components/*`. La app lo importa en su `styles.css` (`@import '@argos/ui/tokens.css'; @import '@argos/ui/theme.css'; @source` del paquete). Antes de crear UI, reutiliza `Button`, `TextField`, `Badge`, `StatusIndicator`, `SectionHeader`, `IncidentCard`, `DispatchRow`, `ShelterGauge`, `Masthead` (`import { … } from '@argos/ui'`). Diseño original: artifact «ARGOS Táctico» (claude.ai/artifact/76VQGbSKuuaE5BcfiiByf8). Migrado: `apps/desktop` (única app activa).

### Paleta activa (un color = un significado)
| Rol | Token / clase | Crema (día) | Carbón (noche) |
|---|---|---|---|
| Fondo app | `bg-surface-canvas` | #E8D8C9 | #1A1A1A |
| Panel sobre mapa | `bg-surface-panel` | #F4EBE1 | #242322 |
| Cards / inputs | `bg-surface-raised` | #FAF5EF | #2E2C2A |
| Acción (solo acciones) | `bg-action-primary` + `text-text-on-accent` | #F3701E + #1A1A1A | igual |
| Confirmación / foco | `bg-action-secondary`, `shadow-focus` | #4B607F | #A9B6CA |
| Texto | `text-text-primary` / `-secondary` / `-muted` | Carbón / Pizarra / Grafito | Crema / Pizarra clara / Grafito |
| Crítico (riesgo vital) | `text-status-critical`, `bg-status-critical-bg` | #A3221B | #FF8F80 |
| Advertencia | `text-status-warning`, `bg-status-warning-bg` | #7A5200 | #E9B44C |
| Éxito / disponible | `text-status-success`, `bg-status-success-bg` | #1D6363 | #74CFC6 |

Tema: `document.documentElement.dataset.theme = "crema" | "carbon"` (en desktop, `src/tema.ts` lo aplica y lo recuerda; el mapa lee los tokens con `leerToken`/`observarTema` y se repinta al cambiar).

### Combinaciones obligatorias
- Acción primaria: `<Button variant="primary">` (naranja + texto Carbón + micro-borde Carbón + `shadow-offset`; pressed = `press-mechanical` (utilidad `active:press-mechanical`)). Máximo UNO por vista/fila.
- Todo estado = color + glifo + palabra (`<Badge severity|status|incident>` o `<StatusIndicator>`). Glifos: ■ crítico · ▲ advertencia · ● éxito · ◆ info/en escena · ○ inoperativo.
- Números, horas, códigos y aforos: `font-mono tabular` (`text-data-md`, `text-data-sm`, `text-data-xl`).
- Títulos: `font-display` (Space Grotesk). UI: `font-ui` (Lexend). Etiquetas de botón y overlines: `font-mono text-overline uppercase`.
- Foco: `focus-visible:shadow-focus` (Pizarra). Error de input: `border-input-border-error shadow-error` (ya lo trae `TextField`) + mensaje con ■ y `role="alert"`.
- Secciones del panel: filete `border-t-rule border-border-strong` (ya lo trae `SectionHeader`) + overline numerado ("01 INCIDENTES").
- Espaciado solo en la escala 4px (`1,2,3,4,5,6,8,10,12,16`); alturas `h-control-sm|md|lg`, filas `min-h-row`, panel `w-panel`.

### Prohibido (AI slop)
- ❌ Hex, `rgb()` o clases arbitrarias de color (`bg-[#...]`, `text-[...]`). Usa solo clases semánticas.
- ❌ Glasmorfismo: `backdrop-blur`, fondos translúcidos o `/opacity` en paneles sobre el mapa. Paneles sólidos + `border-border-strong` + `shadow-overlay`.
- ❌ Botones píldora o radios > 4px: solo `rounded-xs` (controles), `rounded-sm` (cards), `rounded-none` (estructura). `rounded-marker` solo en marcadores del mapa.
- ❌ Degradados (especialmente violeta/azul), sombras difusas decorativas, emoji en UI.
- ❌ Texto blanco sobre naranja (2.9:1) y naranja como texto sobre crema (usa `text-text-accent`).
- ❌ Naranja como color de estado; rojo para algo que no sea riesgo vital.
- ❌ Estado comunicado solo por color; borde lateral de color en cards como acento.
- ❌ Fuentes Inter/Roboto/Arial como elección; `Cabinet Grotesk` solo como fallback de display.

Verificación antes de cerrar una tarea de UI: contraste AA (4.5:1 texto, 3:1 bordes/iconos/foco) en **ambos** temas, navegación por teclado con foco visible y `prefers-reduced-motion` respetado.
