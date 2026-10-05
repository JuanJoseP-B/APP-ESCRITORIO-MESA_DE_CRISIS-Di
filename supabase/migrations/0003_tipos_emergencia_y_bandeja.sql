-- Catálogo completo de tipos de emergencia (TIPOS_EMERGENCIA en @argos/shared) y fecha de recepción
-- para la "Bandeja de Reportes Entrantes" de la Mesa de Crisis. Se aplica después de 0001 o de 0002. Idempotente.

-- ---------------------------------------------------------------- tipos de emergencia
alter table public.reportes_ciudadanos drop constraint if exists reportes_tipo_valido;
alter table public.reportes_ciudadanos drop constraint if exists reportes_ciudadanos_tipo_check;

update public.reportes_ciudadanos set tipo = 'INCENDIO' where tipo = 'Incendio';
update public.reportes_ciudadanos set tipo = 'VIA_BLOQUEADA' where tipo = 'Bloqueo';

-- Si quedan filas con el antiguo tipo 'Otro' esta sentencia falla a propósito: no tiene equivalente
-- en el catálogo y hay que reclasificarlas a mano antes de volver a aplicar la migración.
alter table public.reportes_ciudadanos add constraint reportes_tipo_valido
  check (tipo in ('INCENDIO', 'CRECIENTE_SUBITA', 'DESLIZAMIENTO', 'VIA_BLOQUEADA', 'FUGA_GAS', 'INUNDACION'));

-- ---------------------------------------------------------------- fecha de recepción
alter table public.reportes_ciudadanos add column if not exists creado_en timestamptz not null default now();

-- ---------------------------------------------------------------- realtime
-- La Mesa de Crisis recibe por WebSocket cada INSERT/UPDATE de reportes; RLS limita la entrega a operadores.
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reportes_ciudadanos') then
    alter publication supabase_realtime add table public.reportes_ciudadanos;
  end if;
end $$;
