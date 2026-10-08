# PROGRESO · Demo-first (UI/UX)
**Rama:** `feat/cad-fase2-logica` · `npm run check`: 101 archivos, 896 pruebas, 0 errores (al cierre de U6).

## Enfoque
El proyecto se evalúa por UI/UX: el **modo demo es el producto principal** (sin credenciales Supabase, servicio en memoria).
**Backend CONGELADO:** sin más migraciones, RPC ni triggers. Las migraciones 0005 y 0006 quedan en el repo y NO se aplican al proyecto real. `medirDesfaseServidor` sigue exportada sin uso (desfase fijo en 0).

## Subfases
- **U1–U5 (hechas):** base del demo y escenario · ingesta F2 y duplicados · ajustes, tema e idioma (i18n ES/EN) · mapa táctico con unidades y anillos · SLA y atajos (J/K/D/Enter, F1).
- **U6 · Copiloto (hecha):** motor de reglas local (`domain/motorReglas.ts`), tarjeta, previsualización en el mapa y confirmación por acción; atajo A.
- **U7 · Tutorial guiado:** hoy «Ver tutorial» está deshabilitado con «Próximamente».
- **U8 · Pulido y entrega:** contraste AA en ambos temas, teclado, reduced-motion, docs (ROADMAP, SPEC, README, CLAUDE.md).

## Decisiones (el choque se resuelve por lo más simple)
- U3–U5: texto visible con `t('clave')`; la bitácora y los canales crudos siguen en español. El SLA cuenta desde el último ASIGNADO (ALERTA ≥ 80 %). El filtro de SLA de la cola muestra ALERTA y VENCIDO.
- U6 · contratos: `SnapshotAsesor` añade `contexto` (SLA vencidos, unidades en zona caliente) e `incidenteId` por recurso; `ErrorAsesor` añade `SIN_RECOMENDACION` (incidente sin tipo). El motor se cambia con la fábrica `crearMotorReglas` (interfaz `MotorAsesor`).
- U6 · reglas: una unidad por tipo requerido (`NECESIDADES_POR_TIPO`), la libre más cercana; un tipo ya asignado al incidente cuenta como cubierto, así que el incidente inicial del demo no recibe unidades hasta liberar una. Refugios y zona caliente se analizan contra el perímetro de protocolo propuesto.
- U6 · refugio: se prefiere uno fuera de los anillos; si no hay, el de más cupo en el anillo de evacuación, con aviso (en el demo todos caen dentro de 800 m). «Fijar refugio» solo queda en la bitácora: no hay vínculo incidente-refugio ni cambia la ocupación.
- U6 · confirmación: despachar usa `cambiarEstadoRecurso` con origen `IA` (valor existente del evento); la bitácora firma `ASESOR · operador`. Una unidad que ya no está libre al confirmar se rechaza. Esc cierra la tarjeta sin registrar; [DESCARTAR] sí registra. Un incidente Resuelto no ofrece asesor.
- Los archivos existentes conservan sus finales de línea (`App.tsx` está en CRLF).

## Pendiente heredado
- Retirar `Reporte` en favor de `Llamada`; `recursos_operativos` solo para operadores en los docs. Supabase solo con `VITE_USAR_SUPABASE=true` (0006 sin aplicar).
- Sin navegador no se verificó a ojo: contraste AA, foco visible y reduced-motion de lo nuevo (cronómetro, avisos, despacho, hoja, tarjeta y confirmación del asesor, previsualización discontinua en el mapa) quedan para U8.

## Opcional futuro
- MotorClaude: implementación de MotorAsesor vía comando Tauri.
