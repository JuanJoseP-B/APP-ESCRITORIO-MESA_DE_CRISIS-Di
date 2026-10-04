-- ATENCIÓN: borra TODAS las tablas de la aplicación y sus datos. Úsalo solo en desarrollo,
-- antes de ejecutar migrations/0001_esquema_y_rls.sql sobre una base creada a mano.
drop trigger if exists incidentes_sincroniza_zona_riesgo on public.incidentes;
drop table if exists public.zonas_riesgo cascade;
drop table if exists public.recursos_operativos cascade;
drop table if exists public.reportes_ciudadanos cascade;
drop table if exists public.zonas_publicas cascade;
drop table if exists public.incidentes cascade;
drop function if exists public.sincronizar_zona_riesgo() cascade;
drop function if exists public.es_operador() cascade;

-- Políticas y bucket previos (si existían). El bucket solo se puede borrar vacío.
drop policy if exists reportes_fotos_subida on storage.objects;
drop policy if exists reportes_fotos_lectura on storage.objects;
