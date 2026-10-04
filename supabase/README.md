# Supabase: esquema, RLS y datos de ejemplo

## Dos caminos según el estado de tu base
- **Base ya creada a mano (con datos/usuarios):** aplica solo `migrations/0002_alinear_esquema_y_rls.sql`. No borra datos: añade columnas faltantes, crea `zonas_riesgo`, reemplaza políticas y privilegios, y crea el bucket `reportes`. (Es el que se aplicó al proyecto real.)
- **Base vacía:** usa el orden de abajo.

## Orden de ejecución para una base vacía (SQL Editor, uno tras otro)
1. `reset.sql` — solo si ya existen tablas creadas a mano (borra todo `public.*` de la app). Si el bucket `reportes` ya existe, vacíalo/bórralo antes en Storage.
2. `migrations/0001_esquema_y_rls.sql` — tablas, trigger `zonas_riesgo` (espejo público sin `timeline`), RLS, bucket `reportes`, Realtime.
3. `seed.sql` — 5 recursos, 2 refugios, 1 bloqueo y 1 incidente de ejemplo.

## Usuarios
- Authentication → Providers: Email activo; en desarrollo desactiva "Confirm email".
- Authentication → Users → *Add user*: crea `operador@…` (y opcionalmente un `ciudadano@…` para probar el rechazo).
- Da el rol al operador (el usuario no puede editar `app_metadata`):
  ```sql
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"rol":"operador"}'
  where email = 'operador@…';
  ```
  Cierra sesión y vuelve a entrar para que el JWT incluya el rol.

## Variables de entorno
`apps/desktop/.env` y `apps/web/.env` (ignorados por git; plantilla en `.env.example`):
- `VITE_SUPABASE_URL` = solo el origen, p. ej. `https://xxxx.supabase.co` (sin `/rest/v1/`).
- `VITE_SUPABASE_ANON_KEY` = la clave **anon** (empieza por `eyJ`). Nunca la `service_role`.

## Verificación
- Automática: `npm run test` ejecuta `supabase/rls.test.ts` (análisis estático del SQL).
- Aplicada en el proyecto real (2026-10-04): los asesores de seguridad de Supabase solo reportan "Leaked Password Protection" (se activa en Auth → Passwords, plan Pro).
- Real, con la anon key (todas deben devolver `[]`/401/403, nunca datos):
  ```
  curl "$URL/rest/v1/recursos_operativos?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl "$URL/rest/v1/incidentes?select=*"          -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  ```
  `zonas_riesgo?select=*` debe responder 200 con filas **sin** la columna `timeline`, y un `POST` a
  `reportes_ciudadanos` con `estado_validacion: "Confirmado"` debe fallar con 42501.
