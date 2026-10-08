-- ATENCIÓN: borra TODAS las tablas de la aplicación y sus datos. Úsalo solo en desarrollo,
-- antes de ejecutar migrations/0001_esquema_y_rls.sql sobre una base creada a mano.
-- Cubre el modelo previo (`reportes_ciudadanos`) y el actual (`llamadas` de la 0005; `eventos_recurso` y sus funciones de la 0006).
drop trigger if exists incidentes_sincroniza_zona_riesgo on public.incidentes;
drop table if exists public.zonas_riesgo cascade;
drop table if exists public.eventos_recurso cascade;
drop table if exists public.recursos_operativos cascade;
drop table if exists public.llamadas cascade;
drop table if exists public.reportes_ciudadanos cascade;
drop table if exists public.zonas_publicas cascade;
drop table if exists public.incidentes cascade;
drop function if exists public.ajustar_ocupacion_zona(uuid, integer);
-- Funciones de la migración 0006.
drop function if exists public.transicionar_recurso(uuid, text, uuid, text);
drop function if exists public.ubicacion_de_incidente(uuid);
drop function if exists public.hora_servidor();
drop function if exists public.sellar_timeline() cascade;
drop function if exists public.validar_transicion_recurso() cascade;
drop function if exists public.transicion_recurso_permitida(text, text);
drop function if exists public.coordenada_valida(jsonb);
drop function if exists public.timestamptz_o_null(text);
drop function if exists public.iso_utc(timestamptz);
drop function if exists public.sincronizar_zona_riesgo() cascade;
drop function if exists public.es_operador() cascade;

-- Políticas y bucket previos (si existían). El bucket solo se puede borrar vacío.
drop policy if exists reportes_fotos_subida on storage.objects;
drop policy if exists reportes_fotos_lectura on storage.objects;
