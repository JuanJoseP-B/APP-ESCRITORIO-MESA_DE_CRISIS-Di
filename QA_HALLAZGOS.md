# QA_HALLAZGOS · Subfase U8a

QA en navegador del modo demo (Chrome, viewport 1366 × ~583 útil; 1280 y 1920 medidos forzando el ancho del documento).
Rama `feat/cad-fase2-logica`. Se recorrieron los escenarios A, B y C; el paso 1 (estado inicial), el 9 (ciclo de vida) y el 10 (reiniciar) de A se repitieron al final con todas las correcciones.

## Hallazgos

| ID | Paso | Qué pasó | Qué se esperaba | Severidad | Estado |
|---|---|---|---|---|---|
| E1 | 1, 10 | Reiniciar volvía a una semilla fija: U02 ASIG, M11 ESC, M12 RUTA, M10 INOP (2/6 disponibles). | Todas las unidades DISPONIBLE en su base. | Alta | Corregido `8b14bd6` (cada escenario parte limpio, prueba en `servicioDemo.test.ts`) |
| E2 | 9 | La fuga `demo-1` era semilla fija (reaparecía) y el mapa no filtraba por estado: un incidente resuelto seguía pintado con sus anillos. | Un incidente resuelto sale del mapa y de la cola activa. | Alta | Corregido `8b14bd6` + `c0687ef` (regresión en `geojson.test.ts` y `App.test.tsx`) |
| H01 | 3, 4 | La leyenda del mapa arrancaba desplegada y tapaba el centro, donde se centra la llamada o el incidente. | El foco del mapa a la vista. | Alta | Corregido `70d0cd8` (arranca plegada) |
| H02 | previa | El selector de escenario desbordaba la barra: texto en varias líneas a 1366 y SALIR fuera de pantalla (46 px a 1366, 130 px a 1280). Regresión propia. | Barra en una línea, SALIR visible. | Alta | Corregido `4743f92`, `614cb9f`, `907b73c` |
| H03 | 9 | El panel de un incidente RESUELTO seguía ofreciendo DESPACHAR; la unidad quedaba ligada a un incidente cerrado, con SLA corriendo. | Un incidente resuelto no admite despachos ni cuenta SLA. | Alta | Corregido `17f5c7e` (regresión en `PanelDetalle.test.tsx` y `sla.test.ts`) |
| H04 | 3 | El botón CANCELAR del formulario de llamada sale recortado por la izquierda («ANCELAR») a 1366. | Botón completo. | Media | Abierto |
| H05 | 5 | Despachar (ASIGNADO) y pasar a EN RUTA no dejan línea en la bitácora; solo la llegada (Sistema), la vinculación y el asesor. | Cada cambio de estado de una unidad en la bitácora del incidente. | Media | Abierto |
| H06 | 9 | Al marcar Resuelto las unidades siguen EN ESCENA asignadas y hay que liberarlas a mano; «Abierto hace N min» no se congela. | Avisar o liberar al resolver; duración congelada. | Media | Abierto |
| H07 | 8 | En el análisis del perímetro un refugio al 93 % de aforo sale APTO (solo mide geometría), y «Colegio Central · Zona de evacuación · APTO» contradice la advertencia del asesor. | APTO que considere el cupo y un criterio único con el asesor. | Media | Abierto |
| H08 | 2 | Con más de 3 llamadas la lista de entrantes muestra barra de scroll horizontal (scrollWidth 311 / clientWidth 304) y los botones DESCARTAR quedan desalineados. | Sin scroll horizontal. | Media | Abierto |
| H09 | 11 | Con la semilla limpia el tutorial recorre cola, detalle y asesor sin incidentes: el ancla `asesor` no existe y el paso sale centrado, sin recorte. | Cada paso apunta a algo real. | Media | Abierto |
| H10 | 8 | Con 5 o más SLA vencidos a la vez salen 5 avisos apilados (≈270 px) sobre el centro del mapa durante 8 s. | Un aviso agrupado. | Media | Abierto |
| H11 | 4 | Código de incidente de longitud variable (`#OI4`, `#I10`) derivado del id. | Código legible y estable. | Baja | Abierto |
| H12 | 11 | La tarjeta del asesor no se recalcula al cambiar de idioma: queda en el idioma anterior hasta cerrarla y abrirla. | Texto en el idioma activo. | Baja | Abierto |
| H13 | 11 | Texto grande + inglés: «OVERDUE» toca el borde de la ficha de unidad del tablero. | Texto dentro de la ficha. | Baja | Abierto |
| H14 | 6 | Observado una vez: tras Esc en la confirmación del plan del asesor la tarjeta también desapareció. No se investigó. | Esc cierra solo la confirmación. | Baja | Abierto |

### Comprobado sin hallazgos
- Entrantes con resaltado «NUEVA» y contador; abrir con Enter y crear con Ctrl+Enter; aviso de duplicado con candidato; VINCULAR (☎ N y bitácora) y CREAR INCIDENTE ignorando el aviso.
- Despacho con D y Enter (sin asesor): la unidad llega sola a EN ESCENA y queda en la bitácora. Asesor con A: tarjeta, aplicación parcial (solo lo marcado), descartar, competencia por unidades en C (el último incidente se queda sin unidades).
- SLA: contador «N SLA» en la barra, filtro de cola, avisos en el `role="log"` aria-live, ALERTA y VENCIDO en el tablero y el mapa.
- Perímetros: anillos por tipo, bloqueos que cruzan, unidad no asignada en zona caliente genera alerta y las asignadas no.
- Reiniciar a mitad de escenario y cambiar de escenario (A→B→C): unidades, cola, mapa, bitácora, SLA y avisos vuelven al estado limpio.
- Atajos F1, F2, J, K, D, A, Enter, Esc, `[` y `]`. Tema crema, carbón y sistema; inglés; texto grande; reducir movimiento (0 elementos con animación o transición). Tutorial completo, incluido el paso de F2 (abre el formulario y avanza solo; Esc lo cierra todo).
- Contraste AA del texto visible: 0 fallos en crema y carbón, con estado cargado (SLA vencido y tarjeta del asesor abierta).
- Consola del navegador: sin errores ni warnings (solo el aviso informativo de React DevTools).
- Barra de estado sin desbordar a 1280, 1366 y 1920 en el estado más ancho (3 entrantes y contador SLA).

### Límites de esta pasada
- El navegador de pruebas tiene `prefers-reduced-motion` activo, así que el parpadeo del SLA vencido solo se vio en su variante estática (trama rayada); el parpadeo normal queda cubierto por el CSS y `CronometroSla.test.tsx`.
- 1280 × 720 y 1920 × 1080 se midieron forzando el ancho del documento; no hay captura a esos tamaños porque redimensionar la ventana dejó la pestaña sin renderizar.
- La ventana de Chrome pasaba a `hidden` y las capturas daban timeout; se reabrió la pestaña varias veces. Con la pestaña oculta los temporizadores se frenan y las llamadas del guion llegan en bloque: no es un fallo de la app.

## Mejoras UX
Ordenadas por impacto/esfuerzo.

| # | Problema | Propuesta | Esfuerzo | Impacto |
|---|---|---|---|---|
| 1 | Despachar deja la unidad «Despachado» y exige pulsar EN RUTA aparte; el SLA de 2 min corre mientras tanto. | Opción «Despachar y enviar» (o EN RUTA automático) en el diálogo. | S | Alto |
| 2 | Los avisos de SLA vencido se retiran solos a los 8 s y se apilan sobre el mapa. | Un aviso agrupado («5 unidades con SLA vencido») que dure hasta reconocerlo. | S | Alto |
| 3 | Resolver un incidente no menciona sus unidades. | Al resolver, ofrecer «Liberar N unidades» en el mismo gesto. | S | Alto |
| 4 | La unidad sugerida es la más cercana sin mirar el tipo (P01 Policía para una fuga de gas). | Preseleccionar el tipo adecuado a la emergencia y, a igualdad, la más cercana. | M | Alto |
| 5 | El tutorial arranca sobre una consola vacía y varios pasos no tienen a qué apuntar. | Lanzarlo con un incidente de ejemplo cargado o con el escenario ya iniciado. | M | Alto |
| 6 | La bitácora no refleja los despachos ni los cambios de estado de las unidades. | Una línea por transición (origen MANUAL, IA o SISTEMA). | S | Medio |
| 7 | APTO/NO APTO de refugios ignora el cupo. | «APTO · 8 cupos» o «SIN CUPO» según aforo. | S | Medio |
| 8 | La fila de la cola no dice qué unidades llevan SLA en riesgo. | Badge de SLA en la fila del incidente, además del contador de la barra. | S | Medio |
| 9 | La ficha de unidad del tablero no dice a qué incidente va. | Mostrar el código del incidente asignado en la ficha. | S | Medio |
| 10 | La lista de entrantes crece hasta 3 filas y luego hace scroll en ambos ejes. | Altura propia, sin scroll horizontal y un «+N más». | S | Medio |
| 11 | El nombre del escenario queda truncado en la barra («Deslizamiento p…»). | Mostrar nombre y descripción en una ayuda o en la invitación del primer arranque. | S | Medio |
| 12 | Código de incidente de longitud variable. | Código de longitud fija derivado de un contador por sesión (`#0004`). | S | Bajo |
