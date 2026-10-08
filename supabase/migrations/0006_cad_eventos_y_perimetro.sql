-- Lógica CAD (ROADMAP_CAD.md, Fase 2). Se aplica después de 0005. Idempotente.
-- 1) Ciclo de vida de recursos: DISPONIBLE, ASIGNADO, EN_RUTA, EN_ESCENA, INOPERATIVO, con un trigger que
--    impone la tabla de transiciones de `TRANSICIONES_RECURSO` (@argos/shared).
-- 2) `eventos_recurso`: bitácora de transiciones con hora del servidor, solo inserción.
-- 3) `incidentes`: prioridad P1–P4, tipo (nullable) y perímetro automático.
-- No borra datos. Si `recursos_operativos` contiene un estado que no sea uno de los cuatro antiguos
-- (ni uno de los cinco nuevos), el `add constraint` de la sección 1 falla a propósito.

do $$
begin
  if to_regclass('public.llamadas') is null then
    raise exception 'Aplica antes la migración 0005 (tabla public.llamadas)';
  end if;
end $$;

-- ---------------------------------------------------------------- 1) estados de recurso
alter table public.recursos_operativos drop constraint if exists recursos_operativos_estado_actual_check;
alter table public.recursos_operativos drop constraint if exists recursos_estado_valido;

-- Se migra antes de crear el trigger de transiciones para que estos UPDATE no lo disparen.
update public.recursos_operativos set estado_actual = case estado_actual
    when 'Disponible' then 'DISPONIBLE'
    when 'Despachado' then 'ASIGNADO'
    when 'En Escena' then 'EN_ESCENA'
    when 'Inoperativo' then 'INOPERATIVO'
  end
  where estado_actual in ('Disponible', 'Despachado', 'En Escena', 'Inoperativo');

alter table public.recursos_operativos add constraint recursos_estado_valido
  check (estado_actual in ('DISPONIBLE', 'ASIGNADO', 'EN_RUTA', 'EN_ESCENA', 'INOPERATIVO'));
alter table public.recursos_operativos alter column estado_actual set default 'DISPONIBLE';

-- Misma tabla que TRANSICIONES_RECURSO. Cancelar un despacho (ASIGNADO o EN_RUTA a DISPONIBLE) es válido.
create or replace function public.transicion_recurso_permitida(p_desde text, p_hacia text)
returns boolean
language sql immutable set search_path = '' as $$
  select case p_desde
    when 'DISPONIBLE' then p_hacia in ('ASIGNADO', 'INOPERATIVO')
    when 'ASIGNADO' then p_hacia in ('EN_RUTA', 'DISPONIBLE', 'INOPERATIVO')
    when 'EN_RUTA' then p_hacia in ('EN_ESCENA', 'DISPONIBLE', 'INOPERATIVO')
    when 'EN_ESCENA' then p_hacia in ('DISPONIBLE', 'INOPERATIVO')
    when 'INOPERATIVO' then p_hacia = 'DISPONIBLE'
    else false
  end
$$;

create or replace function public.validar_transicion_recurso() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.estado_actual is distinct from old.estado_actual
     and not public.transicion_recurso_permitida(old.estado_actual, new.estado_actual) then
    raise exception 'Transición de recurso inválida: % -> %', old.estado_actual, new.estado_actual
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

drop trigger if exists recursos_valida_transicion on public.recursos_operativos;
create trigger recursos_valida_transicion
  before update of estado_actual on public.recursos_operativos
  for each row execute function public.validar_transicion_recurso();

-- ---------------------------------------------------------------- 2) eventos_recurso
create table if not exists public.eventos_recurso (
  id uuid primary key default gen_random_uuid(),
  recurso_id uuid not null references public.recursos_operativos (id) on delete cascade,
  incidente_id uuid references public.incidentes (id) on delete set null,
  desde text not null check (desde in ('DISPONIBLE', 'ASIGNADO', 'EN_RUTA', 'EN_ESCENA', 'INOPERATIVO')),
  hacia text not null check (hacia in ('DISPONIBLE', 'ASIGNADO', 'EN_RUTA', 'EN_ESCENA', 'INOPERATIVO')),
  origen text not null default 'MANUAL' check (origen in ('MANUAL', 'IA', 'SISTEMA')),
  creado_en timestamptz not null default now()
);

create index if not exists eventos_recurso_recurso_idx on public.eventos_recurso (recurso_id, creado_en desc);
create index if not exists eventos_recurso_incidente_idx on public.eventos_recurso (incidente_id, creado_en desc);

alter table public.eventos_recurso enable row level security;

-- Solo inserción: no se concede UPDATE ni DELETE y no existen políticas para ellos.
revoke all on public.eventos_recurso from anon, authenticated;
grant select, insert on public.eventos_recurso to authenticated;

drop policy if exists eventos_recurso_lectura on public.eventos_recurso;
create policy eventos_recurso_lectura on public.eventos_recurso
  for select to authenticated using (public.es_operador());
drop policy if exists eventos_recurso_insercion on public.eventos_recurso;
create policy eventos_recurso_insercion on public.eventos_recurso
  for insert to authenticated with check (public.es_operador());

do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'eventos_recurso') then
    alter publication supabase_realtime add table public.eventos_recurso;
  end if;
end $$;

-- ---------------------------------------------------------------- 3) incidentes: prioridad, tipo y perímetro
-- Prioridad: los incidentes anteriores heredan la equivalencia de la criticidad (Crítico P1, Medio P2, Bajo P3).
alter table public.incidentes add column if not exists prioridad text;
update public.incidentes set prioridad = case nivel_criticidad when 'Crítico' then 'P1' when 'Medio' then 'P2' else 'P3' end
  where prioridad is null;
alter table public.incidentes alter column prioridad set not null;
alter table public.incidentes alter column prioridad set default 'P3';
alter table public.incidentes drop constraint if exists incidentes_prioridad_valida;
alter table public.incidentes add constraint incidentes_prioridad_valida check (prioridad in ('P1', 'P2', 'P3', 'P4'));

-- Tipo: nullable. Se rellena con el de su llamada más antigua; sin llamadas queda en null
-- (el perímetro usa entonces los radios por defecto y la coincidencia de tipo en duplicados vale 0).
alter table public.incidentes add column if not exists tipo text;
alter table public.incidentes drop constraint if exists incidentes_tipo_valido;
alter table public.incidentes add constraint incidentes_tipo_valido
  check (tipo is null or tipo in ('INCENDIO', 'CRECIENTE_SUBITA', 'DESLIZAMIENTO', 'VIA_BLOQUEADA', 'FUGA_GAS', 'INUNDACION'));
update public.incidentes i set tipo = l.tipo
  from (select distinct on (incidente_id) incidente_id, tipo
          from public.llamadas where incidente_id is not null order by incidente_id, creado_en asc) l
  where l.incidente_id = i.id and i.tipo is null;

-- Perímetro: { centro: {lat, lng}, radios: {CALIENTE, TIBIA, EVACUACION}, origen, poligonoManual }.
-- El anillo exterior se guarda además en `geometria` (jsonb sin restricción de tipo: admite Point y Polygon),
-- así el trigger `sincronizar_zona_riesgo` lo copia tal cual a `zonas_riesgo`.
alter table public.incidentes add column if not exists perimetro jsonb;
alter table public.incidentes add column if not exists perimetro_origen text;
alter table public.incidentes drop constraint if exists incidentes_perimetro_origen_valido;
alter table public.incidentes add constraint incidentes_perimetro_origen_valido
  check (perimetro_origen is null or perimetro_origen in ('AUTO', 'MANUAL', 'IA'));

-- ---------------------------------------------------------------- 4) recursos: ubicación y base
-- {lat, lng} en grados (el tipo `Coordenadas` de @argos/shared). `ubicacion` es la posición actual: la base
-- mientras la unidad está libre, la del incidente al llegar a la escena, o la que el operador corrige a mano.
-- Siguen protegidas por la misma política `recursos_operador`: sin acceso para anon.
create or replace function public.coordenada_valida(p jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p is null then true
    when jsonb_typeof(p) <> 'object' then false
    when jsonb_typeof(p -> 'lat') is distinct from 'number' or jsonb_typeof(p -> 'lng') is distinct from 'number' then false
    else (p ->> 'lat')::float8 between -90 and 90 and (p ->> 'lng')::float8 between -180 and 180
  end
$$;

alter table public.recursos_operativos add column if not exists ubicacion jsonb;
alter table public.recursos_operativos add column if not exists base jsonb;
alter table public.recursos_operativos drop constraint if exists recursos_ubicacion_valida;
alter table public.recursos_operativos add constraint recursos_ubicacion_valida check (public.coordenada_valida(ubicacion));
alter table public.recursos_operativos drop constraint if exists recursos_base_valida;
alter table public.recursos_operativos add constraint recursos_base_valida check (public.coordenada_valida(base));

-- ---------------------------------------------------------------- 5) hora del servidor
create or replace function public.iso_utc(p timestamptz) returns text
language sql immutable set search_path = '' as $$
  select to_char(p at time zone 'utc', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
$$;

create or replace function public.timestamptz_o_null(p text) returns timestamptz
language plpgsql stable set search_path = '' as $$
begin
  return p::timestamptz;
exception when others then
  return null;
end;
$$;

-- Hora del servidor para corregir el reloj de la consola (se mide el viaje de ida y vuelta en el cliente).
create or replace function public.hora_servidor() returns timestamptz
language sql volatile security invoker set search_path = '' as $$
  select clock_timestamp()
$$;
revoke all on function public.hora_servidor() from public, anon;
grant execute on function public.hora_servidor() to authenticated;

-- ---------------------------------------------------------------- 6) creado_en de incidentes y sellado del timeline
alter table public.incidentes add column if not exists creado_en timestamptz not null default now();

-- Los incidentes anteriores toman como apertura su evento más antiguo con fecha válida.
update public.incidentes i set creado_en = m.minimo
  from (select i2.id, min(public.timestamptz_o_null(e ->> 'timestamp')) as minimo
          from public.incidentes i2,
               jsonb_array_elements(case when jsonb_typeof(i2.timeline) = 'array' then i2.timeline else '[]'::jsonb end) e
         group by i2.id) m
  where m.id = i.id and m.minimo is not null and m.minimo < i.creado_en;

-- Los eventos anteriores (sin `creado_en`) reciben su propia fecha, o la apertura del incidente si no la
-- tienen (formato antiguo `{hora, evento}`), para que el sellado de abajo no los date con la hora de hoy.
update public.incidentes i set timeline = (
    select jsonb_agg(
             case when jsonb_typeof(e.evento) = 'object' and not (e.evento ? 'creado_en')
                  then e.evento || jsonb_build_object(
                         'creado_en', public.iso_utc(coalesce(public.timestamptz_o_null(e.evento ->> 'timestamp'), i.creado_en)))
                  else e.evento end
             order by e.n)
      from jsonb_array_elements(i.timeline) with ordinality as e(evento, n))
  where jsonb_typeof(i.timeline) = 'array'
    and exists (select 1 from jsonb_array_elements(i.timeline) x
                 where jsonb_typeof(x) = 'object' and not (x ? 'creado_en'));

-- `timeline` es jsonb y no admite `default now()`: este trigger sella con la hora del servidor SOLO los
-- eventos que llegan sin `creado_en`. Un evento que ya lo trae (los existentes, que el cliente reenvía al
-- añadir uno nuevo) pasa intacto: nunca se reescribe.
create or replace function public.sellar_timeline() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.timeline is null or jsonb_typeof(new.timeline) <> 'array' then
    return new;
  end if;
  new.timeline := coalesce((
    select jsonb_agg(
             case when jsonb_typeof(e.evento) = 'object' and not (e.evento ? 'creado_en')
                  then e.evento || jsonb_build_object('creado_en', public.iso_utc(now()))
                  else e.evento end
             order by e.n)
      from jsonb_array_elements(new.timeline) with ordinality as e(evento, n)
  ), '[]'::jsonb);
  return new;
end;
$$;

drop trigger if exists incidentes_sella_timeline on public.incidentes;
create trigger incidentes_sella_timeline
  before insert or update of timeline on public.incidentes
  for each row execute function public.sellar_timeline();

-- ---------------------------------------------------------------- 7) RPC transicionar_recurso
-- Punto del incidente: `perimetro.centro` si existe; si no, el punto de su geometría o el centroide de los
-- vértices del anillo exterior (sin repetir el vértice de cierre).
create or replace function public.ubicacion_de_incidente(p_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
  select case
    when i.perimetro -> 'centro' is not null and public.coordenada_valida(i.perimetro -> 'centro') then i.perimetro -> 'centro'
    when i.geometria ->> 'type' = 'Point' then
      jsonb_build_object('lat', (i.geometria #>> '{coordinates,1}')::float8, 'lng', (i.geometria #>> '{coordinates,0}')::float8)
    when i.geometria ->> 'type' = 'Polygon' then (
      select jsonb_build_object('lat', avg((v.punto ->> 1)::float8), 'lng', avg((v.punto ->> 0)::float8))
        from jsonb_array_elements(i.geometria #> '{coordinates,0}') with ordinality as v(punto, n)
       where v.n < jsonb_array_length(i.geometria #> '{coordinates,0}'))
  end
  from public.incidentes i
  where i.id = p_id
$$;

-- Cambia el estado del recurso e inserta su evento en una sola transacción, con la hora del servidor.
--  - ASIGNADO exige incidente; EN_RUTA y EN_ESCENA lo conservan; DISPONIBLE e INOPERATIVO lo liberan.
--  - Al pasar a EN_ESCENA la unidad toma la ubicación del incidente; al quedar DISPONIBLE regresa a su base.
--  - Cancelar un despacho (ASIGNADO o EN_RUTA a DISPONIBLE) también deja evento, con el incidente liberado.
-- `security invoker`: la política `recursos_operador` decide quién puede leer y escribir; sin rol de operador
-- el recurso "no existe" para la función.
create or replace function public.transicionar_recurso(
  p_id uuid,
  p_hacia text,
  p_incidente uuid default null,
  p_origen text default 'MANUAL'
) returns setof public.recursos_operativos
language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_actual public.recursos_operativos;
  v_nuevo public.recursos_operativos;
  v_incidente uuid;
  v_ubicacion jsonb;
  v_escena jsonb;
begin
  select * into v_actual from public.recursos_operativos where id = p_id for update;
  if not found then
    raise exception 'Recurso % no encontrado o sin permiso', p_id using errcode = 'no_data_found';
  end if;
  if not public.transicion_recurso_permitida(v_actual.estado_actual, p_hacia) then
    raise exception 'Transición de recurso inválida: % -> %', v_actual.estado_actual, p_hacia
      using errcode = 'check_violation';
  end if;

  if p_hacia = 'ASIGNADO' then
    if p_incidente is null then
      raise exception 'Despachar un recurso exige un incidente' using errcode = 'null_value_not_allowed';
    end if;
    v_incidente := p_incidente;
  elsif p_hacia in ('EN_RUTA', 'EN_ESCENA') then
    v_incidente := v_actual.incidente_asignado_id;
  end if;

  v_ubicacion := v_actual.ubicacion;
  if p_hacia = 'EN_ESCENA' then
    v_escena := public.ubicacion_de_incidente(v_incidente);
    if v_escena is not null and public.coordenada_valida(v_escena) then
      v_ubicacion := v_escena;
    end if;
  elsif p_hacia = 'DISPONIBLE' and v_actual.base is not null then
    v_ubicacion := v_actual.base;
  end if;

  update public.recursos_operativos
     set estado_actual = p_hacia, incidente_asignado_id = v_incidente, ubicacion = v_ubicacion
   where id = p_id
  returning * into v_nuevo;

  insert into public.eventos_recurso (recurso_id, incidente_id, desde, hacia, origen)
  values (p_id, coalesce(v_incidente, v_actual.incidente_asignado_id), v_actual.estado_actual, p_hacia, p_origen);

  return next v_nuevo;
end;
$$;

revoke all on function public.ubicacion_de_incidente(uuid) from public, anon;
grant execute on function public.ubicacion_de_incidente(uuid) to authenticated;
revoke all on function public.transicionar_recurso(uuid, text, uuid, text) from public, anon;
grant execute on function public.transicionar_recurso(uuid, text, uuid, text) to authenticated;
