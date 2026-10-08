-- Pivote a consola CAD de escritorio (ROADMAP_CAD.md, Fase 1). Se aplica después de 0004. Idempotente.
-- 1) `reportes_ciudadanos` pasa a `llamadas` (registradas por el operador) con canal, prioridad, narrativa,
--    callback, incidente vinculado y operador autor.
-- 2) Desaparece todo acceso del rol público: ya no hay portal ciudadano. Solo `es_operador()` lee o escribe.
-- 3) El bucket `reportes` deja de ser público y queda en solo lectura para operadores.
-- 4) La publicación Realtime sigue la tabla renombrada.
-- No borra datos. Los valores antiguos de `estado_validacion` y `tipo` se conservan tal cual.

-- ---------------------------------------------------------------- reportes_ciudadanos -> llamadas
do $$
begin
  if to_regclass('public.reportes_ciudadanos') is not null and to_regclass('public.llamadas') is null then
    alter table public.reportes_ciudadanos rename to llamadas;
  end if;
end $$;

-- Las restricciones heredadas (`reportes_tipo_valido`, `reportes_estado_valido`, ...) conservan su nombre.
alter table public.llamadas add column if not exists canal text not null default '123'
  check (canal in ('123', 'VHF', 'SENSOR', 'PRESENCIAL'));
alter table public.llamadas add column if not exists prioridad text not null default 'P3'
  check (prioridad in ('P1', 'P2', 'P3', 'P4'));
alter table public.llamadas add column if not exists narrativa text not null default '';
alter table public.llamadas add column if not exists reportante text;
alter table public.llamadas add column if not exists callback text;
alter table public.llamadas add column if not exists incidente_id uuid references public.incidentes (id) on delete set null;
alter table public.llamadas add column if not exists operador_id uuid references auth.users (id) on delete set null default auth.uid();

create index if not exists llamadas_incidente_id_idx on public.llamadas (incidente_id);

-- ---------------------------------------------------------------- RLS: solo operadores
alter table public.llamadas enable row level security;

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public' and tablename = 'llamadas'
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

-- Lectura pública de zonas fuera: se sustituye por lectura exclusiva de operadores.
drop policy if exists zonas_publicas_lectura on public.zonas_publicas;
drop policy if exists zonas_riesgo_lectura on public.zonas_riesgo;

revoke all on public.llamadas, public.zonas_publicas, public.zonas_riesgo from anon;
grant select, insert, update, delete on public.llamadas to authenticated;

create policy llamadas_operador on public.llamadas
  for all to authenticated using (public.es_operador()) with check (public.es_operador());
create policy zonas_riesgo_operador on public.zonas_riesgo
  for select to authenticated using (public.es_operador());
-- `zonas_publicas_operador` (0001/0002) ya cubre la lectura y escritura de refugios y bloqueos.

-- ---------------------------------------------------------------- storage: bucket reportes en solo lectura
update storage.buckets set public = false where id = 'reportes';
drop policy if exists reportes_fotos_subida on storage.objects;
drop policy if exists reportes_fotos_lectura on storage.objects;
create policy reportes_fotos_lectura on storage.objects
  for select to authenticated using (bucket_id = 'reportes' and public.es_operador());

-- ---------------------------------------------------------------- realtime
-- Renombrar la tabla conserva su pertenencia a la publicación; este bloque cubre una base sin ella.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'llamadas') then
    alter publication supabase_realtime add table public.llamadas;
  end if;
end $$;
