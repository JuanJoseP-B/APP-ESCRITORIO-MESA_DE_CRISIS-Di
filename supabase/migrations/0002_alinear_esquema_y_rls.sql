-- Alinea una base creada a mano (sin zonas_riesgo, con lectura pública de incidentes y grants totales
-- para anon) con el diseño de 0001, SIN borrar datos ni usuarios. Idempotente.

-- ---------------------------------------------------------------- columnas y restricciones faltantes
alter table public.reportes_ciudadanos add column if not exists imagen_url text;
alter table public.zonas_publicas add column if not exists nombre text not null default 'Sin nombre';
alter table public.zonas_publicas alter column nombre drop default;
-- Los recursos creados a mano usaban "Tipo - CÓDIGO": se separa el código en `etiqueta`.
alter table public.recursos_operativos add column if not exists etiqueta text;
update public.recursos_operativos
  set etiqueta = nullif(trim(split_part(tipo, ' - ', 2)), ''), tipo = trim(split_part(tipo, ' - ', 1))
  where tipo like '% - %';
update public.recursos_operativos set tipo = 'Policía' where tipo = 'Policia';
update public.reportes_ciudadanos set estado_validacion = 'No confirmado' where estado_validacion is null;
update public.recursos_operativos set estado_actual = 'Disponible' where estado_actual is null;
update public.zonas_publicas set capacidad_actual = coalesce(capacidad_actual, 0), capacidad_maxima = coalesce(capacidad_maxima, 100);

alter table public.reportes_ciudadanos alter column estado_validacion set not null;
alter table public.recursos_operativos alter column estado_actual set not null;
alter table public.zonas_publicas alter column capacidad_actual set not null, alter column capacidad_maxima set not null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'reportes_tipo_valido') then
    alter table public.reportes_ciudadanos add constraint reportes_tipo_valido check (tipo in ('Incendio', 'Bloqueo', 'Otro'));
    alter table public.reportes_ciudadanos add constraint reportes_estado_valido
      check (estado_validacion in ('No confirmado', 'Confirmado', 'Descartado'));
    alter table public.reportes_ciudadanos add constraint reportes_coordenadas_validas
      check (lat between -90 and 90 and lng between -180 and 180);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'recursos_tipo_valido') then
    alter table public.recursos_operativos add constraint recursos_tipo_valido check (tipo in ('Bomberos', 'Ambulancia', 'Policía'));
    alter table public.recursos_operativos add constraint recursos_estado_valido
      check (estado_actual in ('Disponible', 'Despachado', 'En Escena', 'Inoperativo'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'zonas_tipo_valido') then
    alter table public.zonas_publicas add constraint zonas_tipo_valido check (tipo in ('Refugio', 'Bloqueo de Vía'));
    alter table public.zonas_publicas add constraint zonas_capacidad_valida
      check (capacidad_actual >= 0 and capacidad_maxima >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------- rol operador (reemplaza is_operator)
create or replace function public.es_operador() returns boolean
language sql stable security invoker set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') = 'operador'
$$;

-- ---------------------------------------------------------------- espejo público sin timeline
create table if not exists public.zonas_riesgo (
  id uuid primary key references public.incidentes (id) on delete cascade,
  titulo text not null,
  nivel_criticidad text not null,
  estado text not null,
  geometria jsonb not null
);

create or replace function public.sincronizar_zona_riesgo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    delete from public.zonas_riesgo where id = old.id;
  elsif new.estado = 'Resuelto' then
    delete from public.zonas_riesgo where id = new.id;
  else
    insert into public.zonas_riesgo (id, titulo, nivel_criticidad, estado, geometria)
    values (new.id, new.titulo, new.nivel_criticidad, new.estado, new.geometria)
    on conflict (id) do update
      set titulo = excluded.titulo,
          nivel_criticidad = excluded.nivel_criticidad,
          estado = excluded.estado,
          geometria = excluded.geometria;
  end if;
  return null;
end;
$$;
revoke all on function public.sincronizar_zona_riesgo() from public, anon, authenticated;

drop trigger if exists incidentes_sincroniza_zona_riesgo on public.incidentes;
create trigger incidentes_sincroniza_zona_riesgo
  after insert or update or delete on public.incidentes
  for each row execute function public.sincronizar_zona_riesgo();

insert into public.zonas_riesgo (id, titulo, nivel_criticidad, estado, geometria)
  select id, titulo, nivel_criticidad, estado, geometria from public.incidentes where estado <> 'Resuelto'
  on conflict (id) do nothing;

-- ---------------------------------------------------------------- RLS: reemplazo total de políticas
alter table public.incidentes enable row level security;
alter table public.reportes_ciudadanos enable row level security;
alter table public.recursos_operativos enable row level security;
alter table public.zonas_publicas enable row level security;
alter table public.zonas_riesgo enable row level security;

do $$
declare p record;
begin
  for p in select schemaname, tablename, policyname from pg_policies
           where schemaname = 'public'
             and tablename in ('incidentes', 'reportes_ciudadanos', 'recursos_operativos', 'zonas_publicas', 'zonas_riesgo')
  loop
    execute format('drop policy %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

drop function if exists public.is_operator();

-- Privilegios mínimos: se parte de cero y se concede solo lo necesario.
revoke all on public.incidentes, public.reportes_ciudadanos, public.recursos_operativos,
  public.zonas_publicas, public.zonas_riesgo from anon, authenticated;
grant select, insert, update, delete on public.incidentes, public.reportes_ciudadanos,
  public.recursos_operativos, public.zonas_publicas to authenticated;
grant select on public.zonas_riesgo to authenticated;
grant insert on public.reportes_ciudadanos to anon;
grant select on public.zonas_publicas to anon;
grant select on public.zonas_riesgo to anon;

create policy incidentes_operador on public.incidentes
  for all to authenticated using (public.es_operador()) with check (public.es_operador());
create policy recursos_operador on public.recursos_operativos
  for all to authenticated using (public.es_operador()) with check (public.es_operador());

create policy reportes_insert_publico on public.reportes_ciudadanos
  for insert to anon, authenticated with check (estado_validacion = 'No confirmado');
create policy reportes_operador on public.reportes_ciudadanos
  for all to authenticated using (public.es_operador()) with check (public.es_operador());

create policy zonas_publicas_lectura on public.zonas_publicas for select to anon, authenticated using (true);
create policy zonas_publicas_operador on public.zonas_publicas
  for all to authenticated using (public.es_operador()) with check (public.es_operador());
create policy zonas_riesgo_lectura on public.zonas_riesgo for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- storage: fotos de reportes
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('reportes', 'reportes', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
  on conflict (id) do update set public = true, file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];
drop policy if exists reportes_fotos_subida on storage.objects;
create policy reportes_fotos_subida on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'reportes');

-- ---------------------------------------------------------------- realtime
do $$
declare t text;
begin
  foreach t in array array['incidentes', 'reportes_ciudadanos', 'recursos_operativos', 'zonas_publicas', 'zonas_riesgo']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
