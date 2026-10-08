# PROGRESO · Demo-first (UI/UX)

**Rama:** `feat/cad-fase2-logica` · `npm run check`: 95 archivos, 804 pruebas, 0 errores (al cierre de U5).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC, triggers ni sincronización de hora. Las migraciones 0005 y 0006 quedan en el repo y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada sin uso (desfase fijo en 0).

## Subfases
- **U1 · Base del demo (hecha):** reloj local, datos en Pasto, guion de escenario y control de simulación.
- **U2 · Ingesta F2 y duplicados (hecha):** bandeja Entrantes, FormularioLlamada (F2, Esc, Ctrl+Enter), AvisoDuplicado, P1–P4.
- **U3 · Ajustes, tema e idioma (hecha):** i18n ES/EN sin librerías, `PanelAjustes` (⚙), preferencias persistentes.
- **U4 · Mapa táctico (hecha):** marcadores de unidades, movimiento en el demo, anillos, análisis espacial, leyenda y capas.
- **U5 · SLA y atajos (hecha):** `domain/sla.ts`, `CronometroSla`, alertas en la barra, J/K/D/Enter, `DialogoDespacho`, hoja F1.
- **U6 · Copiloto:** Asesor IA con motor determinista (sin API externa ni secretos); atajo A.
- **U7 · Tutorial guiado:** recorrido sobre la consola; hoy «Ver tutorial» está deshabilitado con «Próximamente».
- **U8 · Pulido y entrega:** contraste AA en ambos temas, teclado, reduced-motion, docs (ROADMAP, SPEC, README, CLAUDE.md).

## Decisiones (el choque se resuelve por lo más simple)
- U3: todo texto visible usa `t('clave')`; siguen en español el dominio, la bitácora que escribe la consola y los canales crudos (`123`, `VHF`).
- U4: marcadores y anillos son DOM de MapLibre con colores de tokens; el movimiento (`movimiento.ts`) interpola en línea recta y `useLlegadaUnidades` (solo demo) pasa la unidad a EN_ESCENA. Seleccionar una unidad (mapa o tablero) la resalta y centra el mapa.
- U5 · zona caliente: las unidades EN_ESCENA o EN_RUTA asignadas al incidente seleccionado no alertan (`unidadesAsignadasEnZona`, «en escena» neutro); las demás sí. `UnidadMapa` lleva `incidenteId`.
- U5 · SLA: `calcularSla` cuenta desde el último ASIGNADO (EN_RUTA y EN_ESCENA se miden desde ahí); ALERTA ≥ 80 %, VENCIDO al superar el límite. `useSla` recalcula a 1 Hz con el reloj de la consola.
- U5 · escenario: la M12 arranca EN_RUTA (asignada hace 5 min) con `TRAFICO_ESCENARIO` (0,07× de velocidad): su SLA vence hacia el minuto 5 a 1× y llega hacia el 7; el retraso se anota en la bitácora a los 150 s.
- U5 · barra: el contador «N SLA» suma ALERTA + VENCIDO (color y glifo del más grave). **Desvío:** el filtro de la cola muestra incidentes con unidades en ALERTA o VENCIDO (no solo vencidas) para que coincida con N; se retira solo si N llega a 0. Cada vencimiento nuevo sale en `AvisosSla` (aria-live polite, 8 s).
- U5 · `CronometroSla` (UI): VENCIDO parpadea a 1 Hz; con `reducirMovimiento` o `prefers-reduced-motion` usa borde grueso con rayas. En el chip la palabra va en una cuarta línea (cabe en los 96 px del tablero).
- U5 · atajos: `D` abre `DialogoDespacho` (unidades libres por distancia, la más cercana preseleccionada; ↑↓ cambia, Enter despacha, Esc cancela); `F1`/`?` abren `HojaAtajos` (también Ajustes → Ayuda); `Kbd` de `@argos/ui` es la tecla sutil. `useDialogoModal` comparte foco atrapado/Esc entre Ajustes y la hoja. Enter sobre una entrante enfocada ya funcionaba (es un botón). `A` queda para U6.

## Pendiente heredado
- Retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs. Supabase solo con `VITE_USAR_SUPABASE=true` (0006 sin aplicar).
- Sin navegador no se verificó a ojo: contraste AA, foco visible y reduced-motion de lo nuevo (cronómetro, avisos, despacho, hoja, `--escala-texto`) quedan para U8.
