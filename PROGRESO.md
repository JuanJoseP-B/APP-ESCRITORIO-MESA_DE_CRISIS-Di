# PROGRESO · Demo-first (UI/UX)

**Rama:** `feat/cad-fase2-logica` · `npm run check`: 84 archivos, 682 pruebas, 0 errores (al cierre de U4).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC, triggers ni sincronización de hora. Las migraciones 0005 y 0006 quedan en el repo y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada sin uso (desfase fijo en 0).

## Subfases
- **U1 · Base del demo (hecha):** reloj local, datos en Pasto, guion de escenario y control de simulación.
- **U2 · Ingesta F2 y duplicados (hecha):** bandeja Entrantes, FormularioLlamada (F2, Esc, Ctrl+Enter), AvisoDuplicado, P1–P4.
- **U3 · Ajustes, tema e idioma (hecha):** i18n ES/EN sin librerías, `PanelAjustes` (⚙), preferencias persistentes.
- **U4 · Mapa táctico (hecha):** marcadores de unidades, movimiento en el demo, anillos, análisis espacial, leyenda y capas.
- **U5 · SLA y atajos:** `sla.ts`, CronometroSla, alertas SLA en BarraEstado, atajos D/A.
- **U6 · Copiloto:** Asesor IA con motor determinista (sin API externa ni secretos).
- **U7 · Tutorial guiado:** recorrido sobre la consola; hoy «Ver tutorial» está deshabilitado con «Próximamente».
- **U8 · Pulido y entrega:** contraste AA en ambos temas, teclado, reduced-motion, docs (ROADMAP, SPEC, README, CLAUDE.md).

## Decisiones (el choque se resuelve por lo más simple)
- U3: todo texto visible usa `t('clave')` (`i18n/es.ts` fuente, `en.ts` tipado contra `es`). Siguen en español los valores del dominio, el texto de la bitácora que escribe la consola y los canales crudos (`123`, `VHF`).
- U4 · marcadores y anillos son marcadores DOM de MapLibre (el estilo base no trae tipografías): sus colores salen de tokens CSS y siguen solos el cambio de tema; las capas GeoJSON usan `leerToken` y se repintan.
- U4 · movimiento: `domain/movimiento.ts` interpola en línea recta de la base al incidente (Ambulancia 14, Policía 16, Bomberos 11 m/s) desde el evento EN_RUTA; `useLlegadaUnidades` (solo demo) pasa la unidad a EN_ESCENA y anota «Unidad X llegó a la escena» (autor «Sistema», origen SISTEMA). Con `reducirMovimiento` salta en 4 tramos. En el demo la hora de la consola se refresca cada 250 ms.
- U4 · anillos: se derivan del incidente seleccionado (`perimetro.radios` o `PROTOCOLOS_PERIMETRO`); no se persisten ni hay corrección manual. Opacidades 2×/1,2×/0,6× de `opacidadZona`; trazo continuo/discontinuo/punteado y etiqueta con el radio.
- U4 · análisis (`analisisEspacial.ts`): sección 02 de `PanelDetalle`; toda unidad dentro de CALIENTE alerta (también las en escena). Pasar el cursor o enfocar un ítem lo resalta en el mapa.
- U4 · seleccionar una unidad (mapa o tablero) la resalta en ambos y centra el mapa; repetir el clic la suelta; si tiene incidente asignado también lo selecciona. El mapa ya no se re-encuadra al cambiar solo la bitácora del incidente.
- U4 · la leyenda se pliega (recuerda `argos.leyendaPlegada`) y lleva los interruptores de capa (unidades, perímetros, refugios, bloqueos); las capas viven en el estado de `MapaTactico`.

## Pendiente heredado
- Retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs. Supabase solo con `VITE_USAR_SUPABASE=true` (0006 sin aplicar).
- Sin navegador no se verificó a ojo: contraste AA, foco visible y reduced-motion de lo nuevo (drawer, marcadores, leyenda, `--escala-texto`) quedan para U8.
