# PROGRESO · Demo-first (UI/UX)

**Rama:** `feat/cad-fase2-logica` · `npm run check`: 76 archivos, 617 pruebas, 0 errores (al cierre de U3).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC, triggers ni sincronización de hora. Las migraciones 0005 y 0006 quedan en el
repo tal cual y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada pero sin uso (desfase fijo en 0).

## Subfases
- **U1 · Base del demo (hecha):** reloj local, datos en Pasto, guion de escenario y control de simulación.
- **U2 · Ingesta F2 y duplicados (hecha):** bandeja Entrantes, FormularioLlamada (F2, Esc, Ctrl+Enter), AvisoDuplicado, P1–P4 y ☎ N en la cola.
- **U3 · Ajustes, tema e idioma (hecha):** i18n ES/EN sin librerías, `PanelAjustes` (⚙), preferencias persistentes.
- **U4 · Mapa:** unidades animadas, anillos de perímetro y análisis espacial (turf), corrección manual con draw.
- **U5 · SLA y atajos:** `sla.ts`, CronometroSla, alertas SLA en BarraEstado, atajos D/A.
- **U6 · Copiloto:** Asesor IA con motor determinista (sin API externa ni secretos).
- **U7 · Tutorial guiado:** recorrido sobre la consola; hoy «Ver tutorial» está deshabilitado con «Próximamente».
- **U8 · Pulido y entrega:** contraste AA en ambos temas, teclado, reduced-motion, docs (ROADMAP, SPEC, README, CLAUDE.md).

## Decisiones U3 (el choque se resuelve por lo más simple)
- Regla: todo texto visible nuevo usa `useTexto()` → `t('clave')`; claves en `i18n/es.ts`, `en.ts` tipado contra `es` (clave faltante = typecheck roto). Sin proveedor, `t` responde en español (las pruebas viejas no cambian).
- Valores del dominio (`Crítico`, `DISPONIBLE`…) siguen guardados en español; solo su etiqueta se traduce (`i18n/etiquetas.ts`). El texto de la bitácora que escribe la consola y el canal crudo (`123`, `VHF`) de la bandeja no se traducen.
- `@argos/ui`: `DispatchRow.statusLabel`, `UnitChip.statusLabel/statusShort` y `StatusIndicator.label` (también con `glyphOnly`) permiten traducir; `RailColapsable` aún dice «Expandir/Colapsar» en español. Nuevos `SegmentedControl` y `Switch`.
- Idioma: `IdiomaProvider` es la única fuente (`argos.idioma`, `<html lang>`); `PreferenciasProvider` lo delega y guarda tema, `reducirMovimiento` y `textoGrande`. Tema `sistema` sigue `prefers-color-scheme` en vivo. El botón «Turno noche/día» se retiró de la barra.
- Texto grande: token `--escala-texto` (1 → 1,15 con `data-text-large`) multiplica todos los `font-size` de `@argos/ui` y de `theme.css`. Reducir movimiento: `data-reduced-motion` apaga transiciones y animaciones.
- Ajustes es un drawer a la derecha sin telón translúcido (capturador invisible que cierra al hacer clic fuera). Con él abierto, los atajos globales de Mesa se desactivan.
- Fuera de U3, aún en español: textos internos de `MapaTactico`, avisos de `useAccionesOperador`/`useAccionesLlamada` (van a U4/U8).
- Los archivos nuevos quedan en LF y los CRLF existentes se respetaron (el índice de git guarda LF).

## Pendiente heredado
- Retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs. Supabase solo con `VITE_USAR_SUPABASE=true` (0006 sin aplicar).
- Sin navegador no se verificó a ojo: contraste AA, foco visible y reduced-motion de lo nuevo (incluido el drawer y `--escala-texto`) quedan para U8.
