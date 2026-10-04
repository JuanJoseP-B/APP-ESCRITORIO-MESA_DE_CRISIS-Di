-- Datos de ejemplo para desarrollo. Ejecutar DESPUÉS de la migración (como postgres, en el SQL Editor).
insert into public.recursos_operativos (tipo, estado_actual) values
  ('Bomberos', 'Disponible'),
  ('Bomberos', 'Disponible'),
  ('Ambulancia', 'Disponible'),
  ('Ambulancia', 'Inoperativo'),
  ('Policía', 'Disponible');

insert into public.zonas_publicas (tipo, nombre, geometria, capacidad_actual, capacidad_maxima) values
  ('Refugio', 'Coliseo Municipal', '{"type":"Point","coordinates":[-77.2830,1.2150]}', 45, 200),
  ('Refugio', 'Colegio Central', '{"type":"Point","coordinates":[-77.2790,1.2110]}', 10, 120),
  ('Bloqueo de Vía', 'Calle 18 cerrada', '{"type":"Point","coordinates":[-77.2845,1.2175]}', 0, 0);

-- El trigger copia este incidente a zonas_riesgo (sin timeline) para el portal.
insert into public.incidentes (titulo, nivel_criticidad, estado, geometria, timeline) values
  ('Fuga de gas en sector', 'Crítico', 'Abierto',
   '{"type":"Point","coordinates":[-77.2811,1.2136]}',
   '[{"timestamp":"2026-10-04T08:00:00Z","descripcion":"Incidente registrado"}]');
