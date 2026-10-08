# PROGRESO · Fase 2 (CAD lógica)

**Rama:** `feat/cad-fase2-logica` (pushed) · **Último commit de código:** `7c2dfb3` · `npm run check`: 59 archivos, 448 pruebas, 0 errores.

## Commits hechos (21)
d97268a prioridades P1–P4 y canales · 46ab09f contratos Llamada/duplicados · 6bc4d41 Incidente prioridad/tipo/creado_en · fbd1505 ui: estado EN_RUTA · 1f63531 ciclo de vida CAD (F2-03) · 5dcc0d6 Recurso ubicacion/base · a5c7af0 SLA_POR_PRIORIDAD · b3514fc anillos/PROTOCOLOS_PERIMETRO · 134e9bc cola por prioridad · 207a56d/17adb68/c58c76a/099d3dc migración 0006 (eventos, coordenadas, sellado timeline + hora_servidor, RPC transicionar_recurso) · ecf0768 eventos.test.ts · 3de18da cad.test.ts · 965b24c seed Pasto/reset/README · 92d98d9 módulos turf · 3ebc7ca geo.ts Haversine · cd02aca Incidente.perimetro · 1d0aa80 duplicados · 7c2dfb3 servicio (llamadas, eventos, RPC, ubicación) + demo.

## Pendiente, en orden
1. **Paso 22 (en stash):** hora del servidor por RPC `hora_servidor` (mejor de 3 muestras, mitad del RTT), quitar `leerCabeceraDate`.
2. Bitácora y cola usan `creado_en` (timeline.ts, cola.ts).
3. F2-11 FormularioLlamada (F2, Esc, Ctrl+Enter) + useAccionesLlamada · F2-12 AvisoDuplicado · F2-13 vinculación e indicador de duplicados en la cola (mostrar P1–P4).
4. Retirar `Reporte` en favor de `Llamada` (commit propio, antes de docs).
5. F2-14/15 anillos y análisis espacial (turf) · F2-16 capas + AnalisisPerimetro · F2-17 corrección manual con draw.
6. F2-18 sla.ts puro · F2-19 CronometroSla (parpadeo accesible) + useSla · F2-20 alertas SLA en BarraEstado con filtro.
7. Marcadores de unidades, arrastre que corrige posición, clic en chip centra el mapa, reloj acelerado `?reloj=N`.
8. Docs: ROADMAP_CAD, SPEC, README y CLAUDE.md (regla de `recursos_operativos`: solo operadores, sin anon; glifo flecha de EN_RUTA).

## Decisiones vigentes
- Atajos de la fase: solo F2, Esc y Ctrl+Enter; D, F1 y A van en la Fase 3.
- `incidentes.tipo` nullable: perímetro con RADIOS_POR_DEFECTO y coincidencia de tipo 0.
- Trigger del timeline sella solo eventos sin `creado_en`; las cancelaciones generan evento y detienen el SLA (NO_APLICA).
- Posición: `Recurso.ubicacion`/`base` (jsonb {lat,lng}); EN_ESCENA toma `perimetro.centro` o centroide; DISPONIBLE vuelve a la base.
- Anillo exterior en `incidentes.geometria` (Polygon verificado en jsonb y trigger de zonas_riesgo).
- Familias de tipo (duplicados): INCENDIO/FUGA_GAS, CRECIENTE/INUNDACION, DESLIZAMIENTO/VIA_BLOQUEADA. Radios por tipo son orientativos.
- Servicio demo se fusionó con el commit del servicio; sigue en Santiago (mapa), el seed SQL en Pasto.

## Problemas abiertos
- F2-T2 "distinto tipo a 50 m < 0.6" solo se cumple con ≥15 min de antigüedad; la prueba usa 20 min.
- 0005 y 0006 NO aplicadas al proyecto Supabase real (a la espera de tu orden). La 0006 se validó en Postgres local (PGlite, scratchpad).
- Archivos del árbol usan CRLF; editar con cuidado.

## Stash
`stash@{0}` **wip-hora-servidor-rpc**: cambios sin verificar en `supabaseClient.ts/.test.ts` y `domain/reloj.ts/.test.ts` (paso 1 pendiente).
