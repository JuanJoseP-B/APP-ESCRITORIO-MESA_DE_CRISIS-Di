-- Mesa de Crisis ARGOS: esquema (SPEC §4) y políticas RLS.
-- Rol operador: claim `app_metadata.rol = 'operador'` en el JWT (Supabase Auth).
-- El portal público (rol `anon`) NUNCA accede a `recursos_operativos` ni a `incidentes`.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- tablas
create table public.incidentes (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  nivel_criticidad text not null check (nivel_criticidad in ('Bajo', 'Medio', 'Crítico')),
  estado text not null default 'Abierto' check (estado in ('Abierto', 'Contenido', 'Resuelto')),
  geometria jsonb not null,
  timeline jsonb not null default '[]'::jsonb
);

create table public.reportes_ciudadanos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('Incendio', 'Bloqueo', 'Otro')),
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  imagen_url text,
  estado_validacion text not null default 'No confirmado'
    check (estado_validacion in ('No confirmado', 'Confirmado', 'Descartado'))
);

create table public.recursos_operativos (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('Bomberos', 'Ambulancia', 'Policía')),
  estado_actual text not null default 'Disponible'
    check (estado_actual in ('Disponible', 'Despachado', 'En Escena', 'Inoperativo')),
  incidente_asignado_id uuid references public.incidentes (id) on delete set null
);

create table public.zonas_publicas (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('Refugio', 'Bloqueo de Vía')),
  nombre text not null,
  geometria jsonb not null,
  capacidad_actual integer not null default 0 check (capacidad_actual >= 0),
  capacidad_maxima integer not null default 0 check (capacidad_maxima >= 0)
);

-- Espejo público de incidentes SIN `timeline`. Realtime no soporta vistas, por eso es tabla.
create table public.zonas_riesgo (
  id uuid primary key references public.incidentes (id) on delete cascade,
  titulo text not null,
  nivel_criticidad text not null,
  estado text not null,
  geometria jsonb not null
);

-- ---------------------------------------------------------------- rol operador
create or replace function public.es_operador() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'rol', '') = 'operador'
$$;

-- ---------------------------------------------------------------- espejo por trigger
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

create trigger incidentes_sincroniza_zona_riesgo
  after insert or update or delete on public.incidentes
  for each row execute function public.sincronizar_zona_riesgo();

-- ---------------------------------------------------------------- RLS
alter table public.incidentes enable row level security;
alter table public.reportes_ciudadanos enable row level security;
alter table public.recursos_operativos enable row level security;
alter table public.zonas_publicas enable row level security;
alter table public.zonas_riesgo enable row level security;

-- Sin privilegios por defecto para el público; se conceden solo los necesarios.
revoke all on public.incidentes from anon;
revoke all on public.recursos_operativos from anon;
revoke all on public.reportes_ciudadanos from anon;
revoke all on public.zonas_publicas from anon;
revoke all on public.zonas_riesgo from anon;

-- incidentes y recursos_operativos: solo operadores.
create policy incidentes_operador on public.incidentes
  for all to authenticated using (public.es_operador()) with check (public.es_operador());
create policy recursos_operador on public.recursos_operativos
  for all to authenticated using (public.es_operador()) with check (public.es_operador());

-- reportes_ciudadanos: el público solo inserta (siempre "No confirmado"); operadores gestionan.
grant insert on public.reportes_ciudadanos to anon;
create policy reportes_insert_publico on public.reportes_ciudadanos
  for insert to anon, authenticated with check (estado_validacion = 'No confirmado');
create policy reportes_operador on public.reportes_ciudadanos
  for all to authenticated using (public.es_operador()) with check (public.es_operador());

-- zonas_publicas y zonas_riesgo: lectura pública; escritura de operadores (zonas_riesgo la hace el trigger).
grant select on public.zonas_publicas to anon;
grant select on public.zonas_riesgo to anon;
create policy zonas_publicas_lectura on public.zonas_publicas for select to anon, authenticated using (true);
create policy zonas_publicas_operador on public.zonas_publicas
  for all to authenticated using (public.es_operador()) with check (public.es_operador());
create policy zonas_riesgo_lectura on public.zonas_riesgo for select to anon, authenticated using (true);

-- ---------------------------------------------------------------- storage (bucket de fotos)
insert into storage.buckets (id, name, public) values ('reportes', 'reportes', true)
  on conflict (id) do nothing;
create policy reportes_fotos_subida on storage.objects
  for insert to anon, authenticated with check (bucket_id = 'reportes');
create policy reportes_fotos_lectura on storage.objects
  for select to anon, authenticated using (bucket_id = 'reportes');

-- ---------------------------------------------------------------- realtime
-- Nota: `incidentes` y `recursos_operativos` quedan publicadas para los operadores; al tener RLS,
-- Realtime solo entrega filas que el JWT del suscriptor puede leer (anon no recibe nada).
alter publication supabase_realtime add table
  public.incidentes, public.reportes_ciudadanos, public.recursos_operativos,
  public.zonas_publicas, public.zonas_riesgo;
