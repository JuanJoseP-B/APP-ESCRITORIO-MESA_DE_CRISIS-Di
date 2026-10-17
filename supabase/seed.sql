-- Datos de ejemplo para desarrollo. Ejecutar DESPUÉS de las migraciones hasta la 0006 (como postgres, en el SQL Editor).
-- Las posiciones están en Pasto (Nariño) y son puntos de ejemplo cercanos al sector del incidente, no sedes reales.
-- `base` y `ubicacion` coinciden mientras la unidad está libre; el formato es {lat, lng} en grados.
insert into public.recursos_operativos (tipo, estado_actual, etiqueta, base, ubicacion) values
  ('Bomberos', 'DISPONIBLE', 'U01', '{"lat":1.2142,"lng":-77.2790}', '{"lat":1.2142,"lng":-77.2790}'),
  ('Bomberos', 'DISPONIBLE', 'U02', '{"lat":1.2105,"lng":-77.2838}', '{"lat":1.2105,"lng":-77.2838}'),
  ('Ambulancia', 'DISPONIBLE', 'M11', '{"lat":1.2168,"lng":-77.2815}', '{"lat":1.2168,"lng":-77.2815}'),
  ('Ambulancia', 'INOPERATIVO', 'M10', '{"lat":1.2120,"lng":-77.2760}', '{"lat":1.2120,"lng":-77.2760}'),
  ('Policía', 'DISPONIBLE', 'P01', '{"lat":1.2128,"lng":-77.2805}', '{"lat":1.2128,"lng":-77.2805}');

insert into public.zonas_publicas (tipo, nombre, geometria, capacidad_actual, capacidad_maxima) values
  ('Refugio', 'Coliseo Municipal', '{"type":"Point","coordinates":[-77.2830,1.2150]}', 45, 200),
  ('Refugio', 'Colegio Central', '{"type":"Point","coordinates":[-77.2790,1.2110]}', 10, 120),
  ('Bloqueo de Vía', 'Calle 18 cerrada', '{"type":"Point","coordinates":[-77.2845,1.2175]}', 0, 0);

-- El trigger copia este incidente a zonas_riesgo (espejo sin timeline). Las fechas son explícitas para que la
-- bitácora de ejemplo sea estable; un evento sin `creado_en` lo sella el trigger con la hora del servidor.
insert into public.incidentes (titulo, nivel_criticidad, prioridad, tipo, estado, geometria, timeline, creado_en) values
  ('Fuga de gas en sector', 'Crítico', 'P1', 'FUGA_GAS', 'Abierto',
   '{"type":"Point","coordinates":[-77.2811,1.2136]}',
   '[{"timestamp":"2026-10-04T08:00:00Z","creado_en":"2026-10-04T08:00:00.000Z","descripcion":"Incidente registrado"}]',
   '2026-10-04T08:00:00Z');

-- Llamadas de ejemplo (modelo CAD, migración 0005): una ya vinculada al incidente y otra sin vincular.
-- `operador_id` queda en null porque el seed corre como postgres, sin sesión de operador.
insert into public.llamadas (tipo, lat, lng, canal, prioridad, narrativa, reportante, callback, estado_validacion, incidente_id)
  select 'FUGA_GAS', 1.2136, -77.2811, '123', 'P1', 'Olor fuerte a gas en la esquina del sector.', 'Vecino', '3000000000', 'Confirmado', id
  from public.incidentes where titulo = 'Fuga de gas en sector' limit 1;
insert into public.llamadas (tipo, lat, lng, canal, prioridad, narrativa, estado_validacion) values
  ('INCENDIO', 1.2162, -77.2798, 'VHF', 'P2', 'Humo visible desde una bodega, sin confirmar.', 'No confirmado');
