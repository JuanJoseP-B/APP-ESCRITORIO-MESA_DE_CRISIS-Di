# PROGRESO · Demo-first (UI/UX)

**Rama:** `feat/cad-fase2-logica` · `npm run check`: 69 archivos, 563 pruebas, 0 errores (al cierre de U2).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC, triggers ni sincronización de hora. Las migraciones 0005 y 0006 quedan en el
repo tal cual y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada pero sin uso (desfase fijo en 0).

## Subfases
- **U1 · Base del demo (hecha):** reloj local, datos en Pasto, guion de escenario y control de simulación.
- **U2 · Ingesta F2 y duplicados (hecha):** bandeja Entrantes, FormularioLlamada (F2, Esc, Ctrl+Enter), AvisoDuplicado, P1–P4 y ☎ N en la cola.
- **U3 · Mapa:** unidades animadas, anillos de perímetro y análisis espacial (turf), corrección manual con draw.
- **U4 · SLA y atajos:** `sla.ts`, CronometroSla, alertas SLA en BarraEstado, atajos D/A.
- **U5 · Copiloto:** Asesor IA con motor determinista (sin API externa ni secretos).
- **U6 · Pulido y entrega:** contraste AA en ambos temas, teclado, reduced-motion, docs (ROADMAP, SPEC, README, CLAUDE.md).

## Decisiones U2 (el choque se resuelve por lo más simple)
- El reloj simulado nace en pausa; con t=0 la barra muestra el botón primario «Iniciar escenario». Reiniciar vuelve a ese estado.
- Entrantes = llamadas sin vincular ni descartar: P1 primero y, a igual prioridad, la más reciente arriba. «Nueva» dura 12 s del reloj
  de la consola (a 10× casi no se ve). `Reporte` sigue vivo solo para pintar los pines del mapa (`reporteDeLlamada`).
- Confirmar/descartar de la bandeja vieja desaparece: abrir la llamada lleva al formulario; Descartar queda en la fila.
- Una entrante editada en el formulario no se reescribe en su fila (no hay `actualizarLlamada`): los datos editados van al incidente.
- Ctrl+Enter = crear incidente; con candidatos NO decide: lleva el foco a VINCULAR (el aviso exige elegir). F2 con el drawer abierto no hace nada.
- Candidatos requieren tipo y ubicación válidos. Vincular no escala la prioridad del incidente. Coordenadas con 5 decimales (≈1 m). Ui: nuevos `SelectField` y `TextAreaField`; la cola muestra P1–P4 en vez de la criticidad.
- Bitácora: crear anota «Incidente creado desde llamada…» y cada duplicado descartado; vincular anota «Llamada … vinculada».

## Pendiente heredado
- Retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs. Supabase solo con `VITE_USAR_SUPABASE=true` (0006 sin aplicar).
- Sin navegador no se verificó a ojo: contraste AA, foco visible y reduced-motion de lo nuevo quedan para U6.
