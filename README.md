# ARGOS · Mesa de Crisis

Consola **CAD (Computer-Aided Dispatch)** de respuesta a emergencias: una única aplicación de escritorio para despachadores (`apps/desktop`, Tauri 2 + React + TypeScript) sobre un backend Supabase.

> **Pivote a escritorio (2026-10-07):** el portal ciudadano (`apps/web`) quedó archivado en [`archive/web/`](archive/web) y fuera de los workspaces. El alcance vigente está en [`ROADMAP_CAD.md`](ROADMAP_CAD.md).

**Flujo:** el operador registra una llamada (123, VHF, sensor o presencial) → la vincula a un incidente o crea uno nuevo → define el perímetro de riesgo y despacha unidades desde el detalle del incidente → Realtime sincroniza a todos los puestos.

## Qué incluye
- **Escritorio:** login de operador, mapa (MapLibre) con trazado de polígonos y líneas (`@mapbox/mapbox-gl-draw`), lista de incidentes con `timeline`, confirmar/descartar llamadas, máquina de estados de recursos (Disponible → Despachado → En Escena → Inoperativo), ocupación de refugios y Realtime.
- **Seguridad (RLS):** no hay acceso anónimo. Todas las tablas exigen operador (`app_metadata.rol` del JWT); `recursos_operativos` no lleva coordenadas tácticas.

## Estructura
```
apps/desktop      App de escritorio (Vite + Tauri en src-tauri/)
packages/shared   Tipos y reglas puras compartidas (@argos/shared)
packages/ui       Design system ARGOS Táctico (@argos/ui)
supabase/         Migraciones SQL, seed y pruebas de RLS
archive/web       Portal ciudadano archivado (fuera de los workspaces)
SPEC.md           Especificación
ROADMAP_CAD.md    Roadmap del pivote CAD (manda sobre SPEC.md)
```
Reglas del código: sin `any`, todo acceso a Supabase pasa por `services/supabaseClient.ts` (nunca desde componentes), `Recurso` no tiene coordenadas.

## Requisitos
- Node 22+ y npm (desarrollado con Node 24).
- Un proyecto de Supabase con la BD preparada (ver [`supabase/README.md`](supabase/README.md)).
- Solo para el escritorio como aplicación nativa: Rust (`rustup`), Visual Studio Build Tools (C++) y WebView2 en Windows.

## Configuración (una sola vez)
```bash
npm install
cp apps/desktop/.env.example apps/desktop/.env
```
- `VITE_SUPABASE_URL`: solo el origen, p. ej. `https://xxxx.supabase.co` (sin `/rest/v1/`).
- `VITE_SUPABASE_ANON_KEY`: la clave **anon** (empieza por `eyJ`). Nunca la `service_role`.
- Los `.env` están ignorados por git. **Sin credenciales, la app arranca en modo demo** con datos locales de ejemplo.

Para tener un operador: crea un usuario en Supabase (Authentication → Users) y dale el rol:
```sql
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"rol":"operador"}'
where email = 'operador@tu-dominio.com';
```

## Ejecutar en local

**Como aplicación nativa (Tauri):**
```bash
npm run tauri dev -w @argos/desktop
```
La primera vez compila Rust y tarda varios minutos. Si falla con `cargo not found`, abre una terminal nueva (cargo debe estar en el PATH).

**Solo en el navegador (más rápido):**
```bash
npm run dev -w @argos/desktop
```
Abre http://localhost:1420 (puerto fijo; no debe estar ocupado).

## Calidad y pruebas
```bash
npm run check       # lint + typecheck + tests (debe terminar con 0 errores)
```
Pruebas con Vitest junto al código (`*.test.ts`). `archive/` queda fuera de lint, typecheck y tests.

## Compilar para producción
```bash
npm run tauri build -w @argos/desktop    # instalador .msi/.exe en src-tauri/target/release/bundle/
```

## Flujo de trabajo
GitFlow y Conventional Commits (`feat:`, `fix:`, `docs:`…). Más detalle técnico en [`SPEC.md`](SPEC.md), [`ROADMAP_CAD.md`](ROADMAP_CAD.md) y [`CLAUDE.md`](CLAUDE.md).
