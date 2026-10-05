-- Ajuste atómico del aforo de un refugio (botones +5 / -5 de la Mesa de Crisis). Se aplica después de 0003. Idempotente.
-- Un único UPDATE relativo: dos operadores que pulsan a la vez suman ambos deltas en vez de pisarse
-- (el cliente ya no lee `capacidad_actual` para escribir el valor nuevo).

create or replace function public.ajustar_ocupacion_zona(p_id uuid, p_delta integer)
returns setof public.zonas_publicas
language sql volatile security invoker set search_path = '' as $$
  update public.zonas_publicas
     set capacidad_actual = least(capacidad_maxima, greatest(0, capacidad_actual + p_delta))
   where id = p_id
  returning *
$$;

-- `security invoker`: la política RLS `zonas_publicas_operador` sigue decidiendo quién puede escribir.
-- Si el JWT no es de operador no se actualiza ninguna fila y el cliente recibe un error.
revoke all on function public.ajustar_ocupacion_zona(uuid, integer) from public, anon;
grant execute on function public.ajustar_ocupacion_zona(uuid, integer) to authenticated;
