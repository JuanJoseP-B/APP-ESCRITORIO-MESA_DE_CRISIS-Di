-- Datos de ejemplo para desarrollo. Ejecutar DESPUÉS de la migración (como postgres, en el SQL Editor).
insert into public.recursos_operativos (tipo, estado_actual, etiqueta) values
  ('Bomberos', 'Disponible', 'U01'),
  ('Bomberos', 'Disponible', 'U02'),
  ('Ambulancia', 'Disponible', 'M11'),
  ('Ambulancia', 'Inoperativo', 'M10'),
  ('Policía', 'Disponible', 'P01');

insert into public.zonas_publicas (tipo, nombre, geometria, capacidad_actual, capacidad_maxima) values
  ('Refugio', 'Coliseo Municipal', '{"type":"Point","coordinates":[-77.2830,1.2150]}', 45, 200),
  ('Refugio', 'Colegio Central', '{"type":"Point","coordinates":[-77.2790,1.2110]}', 10, 120),
  ('Bloqueo de Vía', 'Calle 18 cerrada', '{"type":"Point","coordinates":[-77.2845,1.2175]}', 0, 0);

-- El trigger copia este incidente a zonas_riesgo (espejo sin timeline).
insert into public.incidentes (titulo, nivel_criticidad, estado, geometria, timeline) values
  ('Fuga de gas en sector', 'Crítico', 'Abierto',
   '{"type":"Point","coordinates":[-77.2811,1.2136]}',
   '[{"timestamp":"2026-10-04T08:00:00Z","descripcion":"Incidente registrado"}]');

-- Llamadas de ejemplo (modelo CAD, migración 0005): una ya vinculada al incidente y otra sin vincular.
-- `operador_id` queda en null porque el seed corre como postgres, sin sesión de operador.
insert into public.llamadas (tipo, lat, lng, canal, prioridad, narrativa, reportante, callback, estado_validacion, incidente_id)
  select 'FUGA_GAS', 1.2136, -77.2811, '123', 'P1', 'Olor fuerte a gas en la esquina del sector.', 'Vecino', '3000000000', 'Confirmado', id
  from public.incidentes where titulo = 'Fuga de gas en sector' limit 1;
insert into public.llamadas (tipo, lat, lng, canal, prioridad, narrativa, estado_validacion) values
  ('INCENDIO', 1.2162, -77.2798, 'VHF', 'P2', 'Humo visible desde una bodega, sin confirmar.', 'No confirmado');
