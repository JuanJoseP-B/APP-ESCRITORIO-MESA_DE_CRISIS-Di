# ARGOS · Parte 2 — Rediseño del Panel de Operador (sin tocar el mapa)

> Especificación para Claude Code. Stack: **Tauri + React + Tailwind + MapLibre**.
> Prototipo visual: `referencia/panel-prototipo.html` (abrir en navegador y pasar el cursor por las tarjetas de unidades). En el prototipo el mapa es una ilustración SVG; **en la app real el mapa MapLibre se queda exactamente como está**.

---

## 0. Regla principal: EL MAPA NO SE TOCA

- **Prohibido** modificar: el componente del mapa MapLibre, sus capas, estilos, marcadores, zonas, popups, animaciones, controles (Trazar zona, Leyenda) y su lógica.
- El mapa sigue ocupando el área central. Los paneles nuevos **flotan encima** (posición absoluta) o lo enmarcan; si al flotar tapan controles del mapa, ajusta márgenes de los paneles, nunca el mapa.
- Si necesitas datos del mapa (dirección del viento, unidad seleccionada) léelos del estado/store existente; no cambies cómo el mapa los produce.
- Única excepción permitida: llamar `map.resize()` si el contenedor cambia de tamaño al plegar paneles.

## 0.1 Reglas de trabajo
1. Primero **inventaría**: componentes de barra superior, panel izquierdo (Entrantes / Activos / Cerrados), panel derecho (Incidente, Análisis del perímetro, Unidades asignadas), barra inferior de unidades, y el store de estado. Lista archivos y espera confirmación.
2. No cambies lógica de negocio (despacho, simulación, estados, atajos D/A). Solo presentación, microinteracciones y los 2 componentes nuevos.
3. CSS keyframes preferidos; `framer-motion` solo si ya existe. Iconos `lucide-react` si existe.
4. Reutiliza los tokens de la Parte 1 (login). `prefers-reduced-motion` desactiva todo.
5. Hazlo **por fases** (sección 7), con build verde al final de cada una.

---

## 1. Lenguaje visual nuevo (aplica a todo lo que no es mapa)

| Antes | Ahora |
|---|---|
| Cajas rectas, radio 2–4px | Islas flotantes **radio 14px**, controles **radio 8–10px**, chips **radio 999px** |
| Sombra dura desplazada | `0 1px 2px rgba(26,26,26,.06), 0 10px 30px rgba(26,26,26,.10)` |
| Paneles pegados al borde | Separados **12px** de los bordes y entre sí |
| Fondo opaco plano | `rgba(248,243,238,.96)` + borde `1px rgba(26,26,26,.12)` |
| Todo en MAYÚSCULA mono | Botones en Lexend con mayúscula inicial; mono solo para datos, códigos y etiquetas |
| Transiciones lineales ≤80ms | 160–220ms `cubic-bezier(.22,1,.36,1)` |

Clase base reutilizable `.island` con lo anterior.

**Encabezado de sección** (`SectionHeader`): chip oscuro con número (`bg #1A1A1A`, texto `#F37021`, mono 11px, radio 6) + título mono 11px tracking .1em + filete 1px que ocupa el resto de la línea. Ej.: `[01] ENTRANTES · 2 ─────`.

---

## 2. Barra superior → tres islas

Posición: top 12, left 12, right 12, alto 56, gap 12, `flex-wrap`.

1. **Isla marca**: `■ ARGOS` (Space Grotesk 700, 20px) · separador · reloj `18:25` mono 20px bold con segundos `:50` en gris `#8A8178` · bloque de 2 líneas "TURNO DÍA · UTC-5" / usuario.
2. **Isla operación** (flex 1):
   - Chip `● EN VIVO` (fondo `#DCEFEC`, texto `#1F5C5C`) con punto que late (`box-shadow` pulse 1.6s infinito).
   - Chip `▲ N ENTRANTES` (fondo `#FBE7C6`, texto `#7A4600`).
   - Simulación: etiqueta SIM + barra de progreso 6px (relleno `#4B5D7A`) + `03:34 / 08:00`.
   - Botón icono Pausar/Reanudar (36×36, radio 10).
   - **Control segmentado** 1× / 5× / 10× con indicador ("thumb") blanco que se **desliza** (`left` transición 220ms) a la opción activa.
   - Reiniciar: mover a menú de ajustes o dejar como botón icono.
3. **Isla sistema**: silenciar, ajustes (el engranaje **rota 60°** en hover, 320ms), avatar circular con iniciales. "Salir" va dentro de un menú del avatar.

---

## 3. Panel izquierdo (flotante)

Posición: left 12, top 80, bottom 108, ancho 300, padding 16, gap 14. Plegable a un riel de iconos de 56px (no desaparece).

- **01 ENTRANTES**: cada llamada es una tarjeta (radio 10, borde 1px, fondo `#FFFDFA`):
  - Fila 1: chip `■ P1` (fondo `#A8261E`, texto blanco) · canal (PRESENCIAL / LÍNEA 123) · temporizador mono a la derecha.
  - **Temporizador por umbral**: < 2 min normal; ≥ 2 min color `#9A5A00`; ≥ 4 min `#A8261E` parpadeando (`steps(2)` 1s) y borde de la tarjeta rojo al 35%.
  - Fila 2: tipo + botón "Descartar" (ghost, 28px).
  - **Entrada nueva**: slide desde arriba + pulso de borde 1 vez.
  - **Descartar**: la tarjeta sale deslizando a la izquierda (220ms), las siguientes suben (`layout` animado o `max-height`). Mostrar toast "Llamada descartada · Deshacer (5 s)" que revierte la acción.
- **Activos / Cerrados**: control segmentado de ancho completo con thumb deslizante.
- **Incidente activo seleccionado**: tarjeta **oscura** (`#1A1A1A`, texto crema, radio 12, sombra `0 8px 20px rgba(26,26,26,.2)`), con chip P1, código mono `INC-0413`, tiempo, descripción 14px y chips "▲ 1 en ruta", "☎ 1 llamada". No seleccionados: tarjeta clara con hover `background rgba(26,26,26,.04)`.

---

## 4. Panel derecho (flotante)

Posición: right 12, top 80, bottom 108, ancho 368, padding 16, gap 14, scroll interno con scrollbar fina.

### 4.1 `01 INCIDENTE`
- Título Space Grotesk 700, 20px.
- Chips: `■ CRÍTICO` (rojo) · `◆ ABIERTO` (fondo `#DDE3EE`, texto `#33425A`). **Cuando el estado cambie**, la palabra hace un *flip* vertical (`rotateX 0 → 90° → 0`, 300ms) al cambiar el texto.
- Acciones:
  - **Despachar unidad** (primario naranja, borde carbón, radio 9): flecha que se desplaza 5px a la derecha en hover; kbd `D`. Al confirmar despacho: el botón muestra "✓ Despachada" 1 s.
  - **Asesor** (pizarra `#4B5D7A`, texto blanco) con kbd `A`.
  - **Marcar contenido / Marcar resuelto**: **pulsación sostenida** de 700ms. Un relleno (`rgba(46,140,131,.22)`) crece de izquierda a derecha mientras se mantiene; si se suelta antes, se cancela. Accesible por teclado: mantener Espacio/Enter.

### 4.2 `02 LÍNEA DE TIEMPO` — **componente nuevo** `IncidentTimeline`
Lista vertical (`<ol>`) de eventos del incidente, derivados del estado existente (no inventar datos):
`Llamada recibida → Incidente creado → Unidad despachada → En ruta → En escena → Contenido → Resuelto`.
- Columna hora (mono 11px) · columna nodo + línea (2px) · texto 13px.
- Completados: nodo 10px carbón, línea carbón.
- **Actual**: etiqueta "AHORA" en `#A84A0F`, nodo 12px naranja con borde carbón y **pulso**; si es "En ruta", debajo barra de ETA (6px, naranja) que avanza con el ETA real.
- Pendientes: nodo hueco gris, opacidad .5, agrupados en una línea.
- Al llegar un evento nuevo, el nodo aparece con `scale 0 → 1` y la línea se "rellena" hacia abajo (200ms).

### 4.3 `03 PERÍMETRO / REFUGIOS`
Mantener el contenido actual (zonas 100/300/800 m, bloqueos) pero cada refugio con:
- Nombre + chip `● APTO` (verde `#DCEFEC/#1F5C5C`) o `■ NO APTO` (`#F6D9D6/#8A1F18`).
- **Medidor de aforo** 6px (relleno `#2E8C83`) + texto `045/200` mono.

### 4.4 `04 UNIDADES ASIGNADAS`
Igual que hoy, con el nuevo estilo de fila; estado vacío con sugerencia: "Sin unidades · Sugerida: M10 · 0,9 km".

---

## 5. Tarjeta de viento — **componente nuevo** `WindCard`
- Isla flotante sobre el mapa, esquina superior izquierda del área del mapa (left = 12 + ancho panel izq + 12; top 80). Ancho 232, padding 14. **Es un overlay HTML, no una capa del mapa.** Debe tener `pointer-events:auto` solo en sí misma y no bloquear el resto del mapa.
- Brújula SVG 76px: círculo, N/E/S/O, aguja naranja que apunta a la dirección del viento y **oscila ±6°** (4s ease-in-out infinito) para sensación de "en vivo".
- Textos: `VIENTO · EN VIVO` (mono 10px), velocidad `14 km/h` (mono 22px bold), `SO → NE · 44°`, y recomendación 11px color `#7A3410` (p. ej. "La nube se desplaza al NE. Evacuar ese sector primero.") derivada de la dirección.
- Fuente de datos: si el proyecto ya tiene viento/clima en la simulación, úsalo. Si no, crea un mock en el store de la simulación (`wind: { speedKmh, fromDeg }`) claramente marcado como `// TODO: dato real`.
- Plegable a un botón circular con la flecha.
- **No** dibujar la pluma de gas en el mapa (eso sería tocar el mapa). Dejar anotado como mejora futura.

---

## 6. Barra inferior de unidades (microanimaciones por tipo)

Isla: left 12, right 12, bottom 12, alto 84. A la izquierda resumen `UNIDADES 5/6 disponibles` (número mono 20px). A la derecha fila de tarjetas con scroll horizontal si no caben.

**Tarjeta `UnitCard`** (`<button>`, min 150px, alto 72, radio 12, fondo `#FFFDFA`, borde 1px):
- Icono en cuadro 40×40 radio 10, color por tipo:
  - Bomberos: fondo `#FCE3D3`, icono `#C2410C` (llama).
  - Ambulancia: fondo `#DCEFEC`, icono `#1F5C5C` (cruz).
  - Policía: fondo `#DDE3EE`, icono `#33425A` (escudo).
- Código mono 14px bold + chip de estado con distancia: `● DISP · 0,9 km`, `▲ EN RUTA 02:40`.
- Hover común: `translateY(-3px)` + sombra `0 10px 24px rgba(26,26,26,.12)` (200ms). Hover/click también resalta la unidad en el mapa **usando la función de selección que ya exista** (no crear nueva lógica de mapa).
- **Animación por tipo (solo en hover y al despachar, nunca en reposo):**
  - **Bomberos**: la llama hace *flicker* (`scale(1,1) rotate(-3°) ↔ scale(1.08,1.15) rotate(3°)`, 0.5s alternate, origen 50% 90%), glow naranja en el cuadro del icono (`0 0 0 4px rgba(243,112,33,.18), 0 0 18px rgba(243,112,33,.45)`) y 2 chispas de 4px que suben 16px y desaparecen (900ms, desfasadas 300ms).
  - **Ambulancia**: la cruz **late** (doble latido: escala 1.18 al 10% y 30%, ciclo 1.2s) y una **línea de electrocardiograma** (SVG `pathLength=1`, stroke `#2E8C83`) se dibuja a lo ancho del borde inferior de la tarjeta y se desvanece, en bucle mientras hay hover.
  - **Policía**: el cuadro del icono alterna sombra roja izquierda / azul derecha (`steps(2)`, 0.5s) y aparece una franja de 3px arriba de la tarjeta rojo/azul que se desplaza (sirena).
- **Estado EN RUTA**: borde naranja al 60% y barra de ETA de 3px en el borde inferior que avanza según el ETA real.
- **Cambio de estado** (DISP → EN RUTA → EN ESCENA): el chip hace *flip* vertical 300ms.

---

## 7. Plan de implementación por fases

1. **Fase A – Fundamentos**: tokens, clase `.island`, `SectionHeader`, `SegmentedControl`, `Chip`. Sin cambios visibles de layout aún.
2. **Fase B – Layout flotante**: barra superior en islas, paneles izquierdo/derecho y barra inferior como islas sobre el mapa. Verificar que el mapa sigue funcionando idéntico (zoom, arrastre, trazar zona, leyenda, marcadores).
3. **Fase C – Panel izquierdo**: tarjetas de entrantes con umbrales, descartar + deshacer, tarjeta oscura de incidente activo.
4. **Fase D – Panel derecho**: acciones nuevas (flecha, hold-to-confirm, flip), `IncidentTimeline`, medidores de refugio.
5. **Fase E – Unidades**: `UnitCard` con las 3 animaciones por tipo + EN RUTA.
6. **Fase F – WindCard**.
7. **Fase G – Pulido**: reduced motion, foco Pizarra visible en todo, plegado de paneles + `map.resize()`, tema nocturno si existe (en Carbón: islas `#222`, texto crema, mismos acentos).

Tras cada fase: build verde y un resumen corto de lo cambiado.

---

## 8. Criterios de aceptación
- [ ] `git diff` no toca archivos del mapa (componente MapLibre, capas, estilos del mapa).
- [ ] Todas las funciones previas (despacho, simulación, atajos D/A, selección) funcionan igual.
- [ ] Las animaciones de unidades solo ocurren en hover/cambio de estado.
- [ ] Hold-to-confirm cancela si se suelta antes de 700ms.
- [ ] Descartar tiene Deshacer de 5 s.
- [ ] Timeline y WindCard leen datos del store (o mock marcado TODO).
- [ ] A 1280×720 nada se superpone de forma que tape controles del mapa.
- [ ] Reduced motion desactiva todo. Build sin errores.