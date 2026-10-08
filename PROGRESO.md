# PROGRESO · Demo-first (UI/UX)
**Rama:** `feat/cad-fase2-logica` · `npm run check`: 106 archivos, 965 pruebas, 0 errores (al cierre de U7).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC ni triggers. Las migraciones 0005 y 0006 quedan en el repo y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada sin uso (desfase fijo en 0).

## Subfases
- **U1–U5 (hechas):** base del demo y escenario · ingesta F2 y duplicados · ajustes, tema e idioma (i18n ES/EN) · mapa táctico con unidades y anillos · SLA y atajos (J/K/D/Enter, F1).
- **U6 · Copiloto (hecha):** motor de reglas local (`domain/motorReglas.ts`), tarjeta, previsualización en el mapa y confirmación por acción; atajo A.
- **U7 · Tutorial guiado (hecha):** `domain/tutorial.ts` (11 pasos + reductor + flag `argos.tutorialVisto`), `Coachmark` en `@argos/ui`, `layout/TutorialProvider.tsx` e `InvitacionTutorial.tsx`; anclas `data-tutorial` en la grilla, entrantes, formulario, ⚙ y botón del asesor. Entradas: Ajustes → Ayuda, hoja F1 e invitación del primer arranque.
- **U8 · Pulido y entrega:** contraste AA en ambos temas, teclado, reduced-motion, docs (ROADMAP, SPEC, README, CLAUDE.md).

## Decisiones (el choque se resuelve por lo más simple)
- U3–U6: texto visible con `t('clave')`; bitácora y canales crudos siguen en español. El SLA cuenta desde el último ASIGNADO (ALERTA ≥ 80 %). El asesor despacha con origen `IA`, firma `ASESOR · operador` y «Fijar refugio» solo queda en la bitácora.
- U7 · tutorial: mientras está activo, `Coachmark` intercepta el teclado en captura (← → Esc Tab) y apaga los atajos de la consola, salvo la tecla del paso interactivo (F2). El telón son 4 paños con `--surface-inverse` + `--opacity-scrim` (sin hex ni blur).
- U7 · anclas: el provider las busca cada 250 ms y el Coachmark remide igual; si no existe o no se ve, el paso sale centrado sin recorte. Pasos 4 y 5 usan el ancla `formulario` (los duplicados viven dentro). El formulario abierto por F2 del recorrido se cierra al salir de esos pasos o del tutorial.
- U7 · primer arranque: «Ahora no» también marca `tutorialVisto` (no se vuelve a invitar; queda Ajustes/F1). La invitación es una tira inferior sobre el mapa, con botones secundario/ghost para no duplicar el primario. Sin `TutorialProvider`, `useTutorial()` es `null` y los accesos no se ofrecen.
- U7 · simulación: se pausa al iniciar y se reanuda al salir solo si corría. Selecciona el primer incidente activo si no hay selección.
- Los archivos existentes conservan sus finales de línea (`App.tsx`, `FormularioLlamada.tsx` e `index.ts` de ui están en CRLF; `sed -i` de Git Bash los pasa a LF, usa Node/PowerShell).

## Pendiente heredado
- Retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs. Supabase solo con `VITE_USAR_SUPABASE=true` (0006 sin aplicar).
- Sin navegador no se verificó a ojo: contraste AA, foco visible y reduced-motion de lo nuevo (cronómetro, avisos, despacho, hoja, tarjeta del asesor, previsualización, **Coachmark, recorte y popover, invitación**) quedan para U8.
- Opcional futuro: MotorClaude (implementación de MotorAsesor vía comando Tauri).
