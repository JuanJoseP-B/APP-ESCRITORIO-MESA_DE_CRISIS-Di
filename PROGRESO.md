# PROGRESO · Demo-first (UI/UX)
**Rama:** `feat/cad-fase2-logica` · `npm run check`: 120 archivos, 1088 pruebas, 0 errores (al cierre de U9a).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC ni triggers. Las migraciones 0005 y 0006 quedan en el repo y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada sin uso (desfase fijo en 0).

## Subfases
- **U1–U5 (hechas):** base del demo y escenario · ingesta F2 y duplicados · ajustes, tema e idioma (i18n ES/EN) · mapa táctico con unidades y anillos · SLA y atajos (J/K/D/Enter, F1).
- **U6 · Copiloto (hecha):** motor de reglas local (`domain/motorReglas.ts`), tarjeta, previsualización en el mapa y confirmación por acción; atajo A.
- **U7 · Tutorial guiado (hecha):** `domain/tutorial.ts` (11 pasos + reductor + flag `argos.tutorialVisto`), `Coachmark` en `@argos/ui`, `layout/TutorialProvider.tsx` e `InvitacionTutorial.tsx`; anclas `data-tutorial` en la grilla, entrantes, formulario, ⚙ y botón del asesor. Entradas: Ajustes → Ayuda, hoja F1 e invitación del primer arranque.
- **U8a · QA en navegador (hecha):** 3 escenarios de demo (A gas, B deslizamiento, C simultáneos) con selector a t=0; recorrido completo de cada uno; 5 errores Altos corregidos. Detalle y mejoras UX en `QA_HALLAZGOS.md`.
- **U8b · Pulido (parcial):** corregidos H04, H08, H10, H12, H13 y H14. Siguen abiertos H05, H06, H07, H09 y H11 (tocan dominio o el tutorial, no movimiento) y los docs (ROADMAP, SPEC, README).
- **U9a · Movimiento, arranque y sonido (hecha):** tokens de movimiento y `motion`, microinteracciones en `@argos/ui`, coreografías de llamada, creación, vinculación, despacho y resolución; `BootSequence` (`domain/arranque.ts`), sonidos sintetizados (`domain/sonidos.ts`, `services/reproductorSonidos.ts`, `useSonidosConsola`) y sección «Sonido» en Ajustes con altavoz en la barra.

## Decisiones (el choque se resuelve por lo más simple)
- U3–U6: texto visible con `t('clave')`; bitácora y canales crudos siguen en español. El SLA cuenta desde el último ASIGNADO (ALERTA ≥ 80 %). El asesor despacha con origen `IA`, firma `ASESOR · operador` y «Fijar refugio» solo queda en la bitácora.
- U7 · tutorial: mientras está activo, `Coachmark` intercepta el teclado en captura (← → Esc Tab) y apaga los atajos de la consola, salvo la tecla del paso interactivo (F2). El telón son 4 paños con `--surface-inverse` + `--opacity-scrim` (sin hex ni blur).
- U7 · anclas: el provider las busca cada 250 ms y el Coachmark remide igual; si no existe o no se ve, el paso sale centrado sin recorte. Pasos 4 y 5 usan el ancla `formulario` (los duplicados viven dentro). El formulario abierto por F2 del recorrido se cierra al salir de esos pasos o del tutorial.
- U7 · primer arranque: «Ahora no» también marca `tutorialVisto`; la invitación es una tira inferior sobre el mapa. Sin `TutorialProvider` los accesos no se ofrecen. La simulación se pausa al iniciar el tutorial y se reanuda al salir solo si corría.
- U8a · cada escenario parte limpio (6 unidades DISPONIBLE, sin incidentes ni llamadas); `crearServicioDemo()` sin escenario conserva la semilla fija solo para pruebas (`testing/entornoSemilla.ts`). El retraso de la M12 es del escenario A y se anota en la bitácora al ir EN_RUTA. Un incidente resuelto sale del mapa, pierde anillos, no admite despachos y no cuenta SLA. La leyenda del mapa arranca plegada. A t=0 la barra oculta el reloj y Reiniciar para caber a 1280.
- Los archivos existentes conservan sus finales de línea (`App.tsx`, `FormularioLlamada.tsx` e `index.ts` de ui están en CRLF; `sed -i` de Git Bash los pasa a LF, usa Node/PowerShell).
- U9a · arranque: es un telón sobre la consola ya montada y no espera a nadie: a los 2,5 s (600 ms con movimiento reducido) entra aunque algo siga «Cargando» o haya fallado, y la línea lo dice (■ error, ◆ pendiente, como el enlace de la barra). Sale una vez por sesión (no al reiniciar el demo) y se decide al montar. Sin `PreferenciasProvider` (pruebas) no sale. El mapa cuenta como fallido si da error antes de `load`.
- U9a · sonido: el `AudioContext` nace en el primer gesto (listener global en `App`); sin gesto no suena nada, tampoco el tono de arranque. La primera lectura de datos es la base y no suena; varias llamadas a la vez dan un solo aviso (la más prioritaria). «Despacho» suena al pasar a ASIGNADO, venga del operador o del asesor. La sección «Sonido» es la 05, tras Ayuda, para no renumerar las existentes; el volumen usa un `<input type="range">` nativo con `accent-action-secondary`.

## Pendiente heredado
- Retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs. Supabase solo con `VITE_USAR_SUPABASE=true` (0006 sin aplicar).
- U9a en navegador (1366, escenario A): arranque, llamada con 3 ondas P1, incidente con anillos, despacho, resolución, silencio y consola limpia. El navegador de pruebas tiene reduced-motion del SO: las animaciones CSS no se vieron en movimiento (sí la secuencia por pasos, forzando `matchMedia`) ni se oyó el sonido.
- Verificado en navegador en U8a: contraste AA (0 fallos), reduced-motion, tutorial, ajustes y consola limpia. Sin ver: el parpadeo del SLA (el navegador de pruebas tiene reduced-motion del SO) y capturas a 1280/1920 (solo medidas).
- Opcional futuro: MotorClaude (implementación de MotorAsesor vía comando Tauri).
