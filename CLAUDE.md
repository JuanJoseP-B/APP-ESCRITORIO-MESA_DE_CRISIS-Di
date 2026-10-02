# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Monorepo con **npm workspaces** (`apps/*`, `packages/*`), git en `main` con remoto `origin`. `SPEC.md` es la fuente de verdad; léelo antes de implementar. Hecho hasta ahora (Fase 1): monorepo, config TS/ESLint/Vitest y el paquete `@argos/shared`. Pendiente: Supabase/RLS, `apps/desktop` (Tauri), `apps/web` (Vite), auth.

## Comandos

Ejecutar desde la raíz:
- `npm run check`: lint + typecheck + tests. Definition of Done: debe terminar con 0 errores.
- `npm run lint` / `npm run typecheck` / `npm run test` por separado.
- Una sola prueba: `npx vitest run packages/shared/types/incidente.test.ts` (añade `-t "<nombre>"` para un caso concreto).

`typecheck` solo cubre `packages/shared`; al crear cada app, añade su `tsc --noEmit -p apps/<app>` a ese script.

## Estructura

- `tsconfig.base.json` (estricto, `noUncheckedIndexedAccess`) lo extienden todos los paquetes/apps.
- `eslint.config.js` (flat config) impone `@typescript-eslint/no-explicit-any: error`, que es lo que hace cumplir la prohibición de `any`.
- `packages/shared` (`@argos/shared`): tipos TS puros en `types/` (exporta `index.ts`). Cada enum del SPEC es una constante `as const` (p. ej. `NIVELES_CRITICIDAD`) más su tipo derivado. `geometria` es una unión discriminada por `type` (`Point` | `Polygon`). `Recurso` no tiene `lat`/`lng` a propósito; una prueba con `expectTypeOf` lo fija.
- Las pruebas viven junto al código (`*.test.ts`).

## Proyecto

"Mesa de Crisis": sistema C4I de respuesta a emergencias con dos aplicaciones sobre un mismo backend Supabase:
- **Escritorio (operadores):** Tauri + React + TypeScript. CRUD total, cambios de estado, despacho de recursos, trazado de polígonos de zonas de riesgo.
- **Portal web público (ciudadanos):** React + Vite + TypeScript (Vercel), mobile-first. Mapa de solo lectura (zonas de riesgo, refugios) y formulario de "Reporte Rápido" con Geolocation.
- **Común:** Tailwind CSS + Shadcn/UI, Mapbox GL JS / MapLibre (únicos motores de mapas permitidos), Supabase (PostgreSQL, Auth por roles Operador vs. Ciudadano/Anónimo, Realtime por WebSockets).

## Arquitectura

Flujo: el ciudadano envía un reporte (entra como "No confirmado") → aparece como alerta en la Mesa de Crisis → el operador valida, traza el polígono de riesgo y despacha recursos → Supabase Realtime propaga la zona de riesgo y los refugios al portal público.

Tablas principales: `incidentes` (criticidad, estado, `geometria` GeoJSON, `timeline` JSONB), `reportes_ciudadanos`, `recursos_operativos`, `zonas_publicas`.

**Restricción de seguridad clave:** `recursos_operativos` nunca debe ser consultable desde el portal público (ni exponer coordenadas tácticas). Esto se impone con RLS en Supabase y debe validarse explícitamente (Fase 4). El portal solo lee `zonas_publicas` y las zonas de riesgo derivadas de incidentes.

## Reglas de código (obligatorias)

- **Tipos compartidos:** `packages/shared/types` exporta `Incidente`, `Recurso` y `Reporte`; ambas apps los consumen (evita contratos duplicados).
- **Acceso a Supabase aislado:** todas las llamadas pasan por un servicio unificado (p. ej. `services/supabaseClient.ts`); nunca consultar desde componentes de UI.
- **Prohibido `any`** en cualquier archivo TypeScript (tipado estricto).
- **Fuera de alcance (Fase 1):** pasarelas de pago, OAuth/redes sociales (solo email/password y roles internos), gráficos 3D o motores de mapas distintos a Mapbox GL JS / MapLibre.

## Verificación y flujo de trabajo

- Cada hito lleva pruebas unitarias con **Vitest**.
- Definition of Done: `npm run check` con 0 errores (ver Comandos).
- Control de versiones: **GitFlow** y **Conventional Commits**.
