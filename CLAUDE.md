# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Estado del repositorio

Actualmente el repositorio (git, rama `main`, con remoto `origin`) solo contiene `SPEC.md` (la especificación del proyecto), un `README.md` de una línea ("Init") y `.gitignore`. No hay código ni `package.json` todavía. Todo lo descrito abajo proviene de `SPEC.md`; léelo antes de implementar y mantenlo como fuente de verdad. Los comandos de build/test aún no existen: se definirán en la Fase 1.

Nota: `.gitignore` excluye `SPEC.md`, `CLAUDE.md` y `.claude/`, así que estos archivos no se versionan ni llegan al remoto.

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
- Definition of Done: `npm run check` (linter + typecheck, p. ej. `npx tsc --noEmit`) debe terminar con 0 errores. Este script debe crearse en cada paquete/app.
- Control de versiones: **GitFlow** y **Conventional Commits**.
- La estructura (monorepo vs. repos separados para Tauri y Web) aún no está decidida; es una tarea de la Fase 1.
