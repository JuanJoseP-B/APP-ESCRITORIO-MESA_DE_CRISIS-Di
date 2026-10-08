# PROGRESO · Demo-first (UI/UX)

**Rama:** `feat/cad-fase2-logica` · `npm run check`: 62 archivos, 480 pruebas, 0 errores (al cierre de U1).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC, triggers ni sincronización de hora. Las migraciones 0005 y 0006 quedan en el
repo tal cual y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada pero sin uso (desfase fijo en 0).

## Subfases
- **U1 · Base del demo (hecha):** reloj local, datos en Pasto, guion de escenario y control de simulación.
- **U2 · Ingesta F2 y duplicados:** FormularioLlamada (F2, Esc, Ctrl+Enter), AvisoDuplicado, vinculación y P1–P4 en la cola.
- **U3 · Mapa:** unidades animadas, anillos de perímetro y análisis espacial (turf), corrección manual con draw.
- **U4 · SLA y atajos:** `sla.ts`, CronometroSla, alertas SLA en BarraEstado, atajos F2/D/A.
- **U5 · Copiloto:** Asesor IA con motor determinista (sin API externa ni secretos).
- **U6 · Pulido y entrega:** contraste AA en ambos temas, teclado, reduced-motion, docs (ROADMAP, SPEC, README, CLAUDE.md).

## Hecho en U1
- `bd6f1e0` reloj local: el cliente real ya no mide el desfase; no había stash ni cambios a medias que descartar.
- `47470f0` demo en Pasto como el `seed.sql`: 6 unidades (U01, U02, P01, M10, M11, M12), 2 refugios, 1 incidente (fuga de gas P1), mapa centrado allí.
- `3b4c07c` `domain/escenario.ts`: guion de 8 min (gas ×3 con 2 duplicados, deslizamiento, sensor), `eventosHasta` y `eventosEntre`.
- `05205e0` `domain/relojSimulado.ts` + `useSimulacion` + control en `BarraEstado` (reproducir/pausar, 1×/5×/10×, reiniciar).

## Decisiones (el choque se resuelve por lo más simple)
- El escenario arranca solo, en marcha a 1× (la primera llamada entra a los 20 s). Pausar congela también el reloj de la app.
- Reiniciar recrea el servicio y el reloj del demo y remonta la consola (`key`); la sesión no se pierde.
- Sustituye a `?reloj=N`, que nunca llegó a implementarse. `servicioDemo` (singleton) ya no lo usa `App`.
- Los datos iniciales del demo se calculan respecto a la hora del servicio, para que los tiempos y SLA tengan sentido.
- Pendiente heredado: retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs.
