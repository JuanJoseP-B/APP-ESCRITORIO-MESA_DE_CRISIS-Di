# ARGOS · Mesa de Crisis

Sistema C4I de respuesta a emergencias con dos aplicaciones sobre un mismo backend Supabase:

| App | Quién la usa | Tecnología |
|---|---|---|
| **Escritorio** (`apps/desktop`) | Operadores | Tauri 2 + React + TypeScript |
| **Portal web** (`apps/web`) | Ciudadanos (anónimos) | React + Vite + TypeScript, mobile-first |

**Flujo:** el ciudadano envía un Reporte Rápido (con foto y ubicación) → llega a la Mesa de Crisis como alerta "No confirmado" → el operador lo confirma, traza la zona de riesgo y despacha recursos → el portal muestra la zona y los refugios en tiempo real.

## Qué incluye
- **Escritorio:** login de operador, mapa (MapLibre) con trazado de polígonos (Terra Draw), lista de incidentes con `timeline`, confirmar/descartar reportes, máquina de estados de recursos (Disponible → Despachado → En Escena → Inoperativo), ocupación de refugios y Realtime.
- **Portal:** mapa de solo lectura con zonas de riesgo y refugios, formulario de Reporte Rápido (Geolocation + foto) y actualización en vivo.
- **Seguridad (RLS):** el público **nunca** accede a `recursos_operativos` ni a `incidentes`. Solo lee `zonas_publicas` y `zonas_riesgo` (espejo de incidentes sin `timeline`) y solo inserta reportes "No confirmado". El rol operador sale de `app_metadata.rol` del JWT.

## Estructura
```
apps/desktop      App de escritorio (Vite + Tauri en src-tauri/)
apps/web          Portal ciudadano
packages/shared   Tipos y reglas puras compartidas (@argos/shared)
supabase/         Migraciones SQL, seed y pruebas de RLS
SPEC.md           Especificación (fuente de verdad)
```
Reglas del código: sin `any`, todo acceso a Supabase pasa por `services/supabaseClient.ts` (nunca desde componentes), `Recurso` no tiene coordenadas.

## Requisitos
- Node 22+ y npm (desarrollado con Node 24).
- Un proyecto de Supabase con la BD preparada (ver [`supabase/README.md`](supabase/README.md)).
- Solo para el escritorio como aplicación nativa: Rust (`rustup`), Visual Studio Build Tools (C++) y WebView2 en Windows.

## Configuración (una sola vez)
```bash
npm install
```
Copia las plantillas y completa tus claves de Supabase (Settings → API):
```bash
cp apps/desktop/.env.example apps/desktop/.env
cp apps/web/.env.example apps/web/.env
```
- `VITE_SUPABASE_URL`: solo el origen, p. ej. `https://xxxx.supabase.co` (sin `/rest/v1/`).
- `VITE_SUPABASE_ANON_KEY`: la clave **anon** (empieza por `eyJ`). Nunca la `service_role`.
- Los `.env` están ignorados por git. **Sin credenciales, ambas apps arrancan en modo demo** con datos locales de ejemplo.

Para tener un operador: crea un usuario en Supabase (Authentication → Users) y dale el rol:
```sql
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data,'{}'::jsonb) || '{"rol":"operador"}'
where email = 'operador@tu-dominio.com';
```

## Ejecutar en local

### Portal web (ciudadano)
```bash
npm run dev -w @argos/web
```
Abre la URL que muestra la consola (normalmente http://localhost:5173). La ubicación del navegador funciona en `localhost`.

### Escritorio (operador)
**Como aplicación nativa (Tauri):**
```bash
npm run tauri dev -w @argos/desktop
```
La primera vez compila Rust y tarda varios minutos. Abre la ventana "ARGOS · Mesa de Crisis". Si falla con `cargo not found`, abre una terminal nueva (cargo debe estar en el PATH).

**Solo en el navegador (más rápido):**
```bash
npm run dev -w @argos/desktop
```
Abre http://localhost:1420 (puerto fijo; no debe estar ocupado).

### Probar el flujo completo
1. Deja el escritorio abierto e inicia sesión como operador.
2. En el portal, envía un Reporte Rápido: aparece en el escritorio sin recargar.
3. En el escritorio, **Confirma** el reporte (crea el incidente), traza la zona con "Trazar zona" y despacha un recurso.
4. El portal muestra la zona de riesgo al instante; al marcar el incidente como Resuelto, desaparece.

## Calidad y pruebas
```bash
npm run check       # lint + typecheck + tests (debe terminar con 0 errores)
npm run test:load   # prueba de carga de Realtime (1000 clientes simulados)
```
Pruebas con Vitest junto al código (`*.test.ts`).

## Compilar para producción
```bash
npm run build -w @argos/web              # genera apps/web/dist (desplegable en Vercel)
npm run tauri build -w @argos/desktop    # instalador .msi/.exe en src-tauri/target/release/bundle/
```

## Flujo de trabajo
GitFlow y Conventional Commits (`feat:`, `fix:`, `docs:`…). Más detalle técnico en [`SPEC.md`](SPEC.md) y [`CLAUDE.md`](CLAUDE.md).
