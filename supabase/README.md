# Supabase: esquema y RLS

`migrations/0001_esquema_y_rls.sql` crea las tablas del SPEC §4, el espejo público `zonas_riesgo`
(incidentes sin `timeline`, mantenido por trigger), las políticas RLS y el bucket `reportes`.

## Aplicar
- Supabase CLI: `supabase db push`, o pegar el archivo en el SQL Editor del proyecto.
- Operadores: asignar `app_metadata.rol = 'operador'` (solo con `service_role`; el usuario no puede editarlo):
  `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"rol":"operador"}' where email = '...';`

## Verificación
- Automática: `npm run test` ejecuta `supabase/rls.test.ts` (análisis estático del SQL).
- Manual contra el proyecto real (con la anon key del portal), todas deben devolver `[]`/`401`/`403`, nunca datos:
  ```
  curl "$URL/rest/v1/recursos_operativos?select=*" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  curl "$URL/rest/v1/incidentes?select=*"          -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
  ```
  Y `zonas_riesgo?select=*` debe devolver filas sin la columna `timeline`.
