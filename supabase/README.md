# Supabase: esquema, RLS y datos de ejemplo

## Dos caminos según el estado de tu base
- **Base ya creada a mano (con datos/usuarios):** aplica solo `migrations/0002_alinear_esquema_y_rls.sql`. No borra datos: añade columnas faltantes, crea `zonas_riesgo`, reemplaza políticas y privilegios, y crea el bucket `reportes`. (Es el que se aplicó al proyecto real.)
- **Base vacía:** usa el orden de abajo.
- **En ambos casos**, después aplica `migrations/0003_tipos_emergencia_y_bandeja.sql`: amplía `reportes_ciudadanos.tipo` al catálogo `TIPOS_EMERGENCIA` de `@argos/shared` y añade `creado_en` (hora de recepción en la Bandeja de Reportes Entrantes). Sin ella, el portal no puede insertar los tipos nuevos.

- **También en ambos casos**, aplica `migrations/0004_ajustar_ocupacion_zona.sql`: crea la función `ajustar_ocupacion_zona(p_id, p_delta)` que usan los botones `+5` / `-5` de refugios (UPDATE relativo y atómico, `security invoker`, solo `authenticated`). Sin ella esos botones fallan con "function not found".
- **Pivote CAD:** aplica por último `migrations/0005_pivote_escritorio.sql` (idempotente): renombra `reportes_ciudadanos` a `llamadas` (con `canal`, `prioridad`, `narrativa`, `reportante`, `callback`, `incidente_id`, `operador_id`), retira todo acceso del rol `anon` a tablas y zonas, y deja el bucket `reportes` privado y de solo lectura para operadores. **No está aplicada al proyecto real**; hazlo solo cuando el equipo lo confirme, porque el portal archivado deja de funcionar.

- **Lógica CAD (Fase 2):** después de la 0005 aplica `migrations/0006_cad_eventos_y_perimetro.sql` (idempotente; exige la 0005). Migra los estados de recurso a `DISPONIBLE / ASIGNADO / EN_RUTA / EN_ESCENA / INOPERATIVO` (y falla a propósito ante cualquier otro valor), crea `eventos_recurso` (solo inserción), añade `prioridad`, `tipo` (nullable), `perimetro`, `perimetro_origen` y `creado_en` a `incidentes`, `ubicacion` y `base` a `recursos_operativos`, el trigger que sella el `timeline` con la hora del servidor y las RPC `transicionar_recurso` y `hora_servidor`. **No está aplicada al proyecto real**; el cliente nuevo no funciona contra una base sin ella, así que aplícala (tras la 0005) antes de desplegar la consola de la Fase 2.

## Orden de ejecución para una base vacía (SQL Editor, uno tras otro)
1. `reset.sql` — solo si ya existen tablas creadas a mano (borra todo `public.*` de la app). Si el bucket `reportes` ya existe, vacíalo/bórralo antes en Storage.
2. `migrations/0001_esquema_y_rls.sql` — tablas, trigger `zonas_riesgo` (espejo público sin `timeline`), RLS, bucket `reportes`, Realtime.
3. `migrations/0003`, `0004`, `0005` y `0006` en ese orden (ver arriba; la 0002 es solo para bases creadas a mano).
4. `seed.sql` — 5 recursos con base en Pasto, 2 refugios, 1 bloqueo, 1 incidente y 2 llamadas de ejemplo (requiere la 0006).

## Usuarios
- Authentication → Providers: Email activo; en desarrollo desactiva "Confirm email".
- Authentication → Users → *Add user*: crea `operador@…` (y opcionalmente un usuario sin rol para probar el rechazo).
- Da el rol al operador (el usuario no puede editar `app_metadata`):
  ```sql
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol":"operador"}'
  where email = 'operador@…';
  ```
  Cierra sesión y vuelve a entrar para que el JWT incluya el rol.

## Variables de entorno
`apps/desktop/.env` (ignorado por git; plantilla en `.env.example`):
- `VITE_SUPABASE_URL` = solo el origen, p. ej. `https://xxxx.supabase.co` (sin `/rest/v1/`).
- `VITE_SUPABASE_ANON_KEY` = la clave **anon** (empieza por `eyJ`). Nunca la `service_role`.

## Verificación
- Automática: `npm run test` ejecuta `supabase/rls.test.ts`, `reportes.test.ts`, `ocupacion.test.ts`, `eventos.test.ts` y `cad.test.ts` (análisis estático del SQL; `eventos.test.ts` también compara el SQL con `ESTADOS_RECURSO` y `TRANSICIONES_RECURSO` de `@argos/shared`).
- Aplicada en el proyecto real (2026-10-04): los asesores de seguridad de Supabase solo reportan "Leaked Password Protection" (se activa en Auth → Passwords, plan Pro).
- Real, con la anon key tras aplicar la 0005 (todas deben devolver `[]`/401/403, nunca datos):
  ```
  curl "$URL/rest/v1/recursos_operativos?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl "$URL/rest/v1/incidentes?select=*"          -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl "$URL/rest/v1/llamadas?select=*"            -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl "$URL/rest/v1/zonas_riesgo?select=*"        -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl "$URL/rest/v1/zonas_publicas?select=*"      -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  ```
  Un `POST` a `llamadas` con la anon key debe fallar con 401/403 (42501).
