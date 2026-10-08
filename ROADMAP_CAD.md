# ARGOS — Mesa de Crisis · Roadmap CAD

> **Estado:** Aprobado · **Fecha:** 2026-10-07 · **Rama base:** `main` (tras fusionar `feat/design-system-argos`)
> **Alcance:** este documento formaliza el pivote de ARGOS a una **consola CAD (Computer-Aided Dispatch) 100 % de escritorio** y reemplaza cualquier referencia al portal ciudadano en SPEC.md. Cuando haya conflicto, SPEC.md debe actualizarse para reflejar este roadmap (ver commit F1-03).

---

## 0. Resumen ejecutivo

| Decisión | Antes | Ahora |
|---|---|---|
| Plataforma | Desktop (operador) + Web (ciudadano) | **Solo desktop (Tauri 2)** |
| Rol del operador | Visor y validador de reportes web | **Despachador CAD**: recibe llamadas 123, radio VHF y sensores |
| Interfaz | Columna lateral con scroll anidado | **Zero-Scroll Tactical Grid** de cuadrantes fijos |
| Ingesta | Formulario ciudadano anónimo | Registro de llamada por el operador, con **detección de duplicados** |
| Zonas de riesgo | Trazado manual | **Perímetros automáticos** de 100 / 300 / 500 m + análisis espacial; trazado manual como corrección |
| Recursos | Máquina de estados sin tiempos | Ciclo de vida CAD con **cronómetros SLA** y alertas |
| IA | — | **Asesor de Despacho Táctico** (Claude API, JSON estructurado, human-in-the-loop) |

**Principios no negociables**

1. **El mapa es el protagonista y nada desplaza la página.** Solo las listas internas pueden hacer scroll.
2. **La IA propone y el operador decide.** Ninguna salida del modelo cambia el estado sin [APLICAR SUGERENCIA].
3. **La lógica de dominio es pura** (`domain/`) y se prueba sin DOM ni red.
4. **Los secretos viven solo en el backend Rust.** La API key nunca llega al bundle del frontend.
5. **Cada commit deja `npm run check` en verde.**

---

## 1. Arquitectura objetivo

### 1.1 Monorepo tras el pivote

```
argos/
├── apps/
│   └── desktop/                 # @argos/desktop — única app
│       ├── src/
│       │   ├── layout/          # NUEVO: grilla táctica
│       │   ├── cad/             # NUEVO: llamadas, duplicados, SLA, perímetros (UI)
│       │   ├── asesor/          # NUEVO: tarjeta del Asesor IA
│       │   ├── domain/          # lógica pura (+ duplicados, perimetro, sla, asesor)
│       │   ├── hooks/
│       │   └── services/
│       └── src-tauri/
│           └── src/
│               ├── main.rs
│               └── asesor/      # NUEVO: cliente Anthropic, esquema, validación
├── packages/
│   ├── shared/                  # @argos/shared — contratos ampliados (§5)
│   └── ui/                      # @argos/ui — nuevos componentes de consola
├── archive/
│   └── web/                     # apps/web archivada (fuera de workspaces)
└── supabase/
    └── migrations/              # + 0005, 0006, 0007
```

### 1.2 Flujo de datos

```
 Operador (teclado)        Supabase (Postgres + Realtime)         Tauri (Rust)
 ──────────────────        ──────────────────────────────         ────────────
 F2 Registrar llamada ──►  llamadas ──► detección duplicados (domain, cliente)
 Crear/vincular incidente ► incidentes ──trigger──► zonas_riesgo
 Despachar unidad ───────► recursos_operativos + eventos_recurso (timestamps)
                                   │ Realtime
                                   ▼
 useListaRealtime ──► domain/sla.ts (reloj 1 Hz) ──► alertas en barra de estado
 domain/perimetro.ts (turf) ──► capas del mapa + análisis de refugios/unidades
 [ASESOR] ──invoke("asesor_despacho", snapshot)──────────────────► cliente HTTPS
                                                                   Anthropic API
 TarjetaAsesor ◄── RecomendacionAsesor (validada en Rust y en TS) ◄─────┘
 [APLICAR SUGERENCIA] ──► confirmación por acción ──► mismas mutaciones que el despacho manual
```

---

## 2. Reestructuración de interfaz: Zero-Scroll Tactical Grid

### 2.1 Grilla

```
┌──────────────────────────────────────────────────────────────────────────────┐
│ A · BARRA DE ESTADO   ARGOS │ 22:15:07 COT │ TURNO NOCHE · op │ ● RT │ ⚠ 2 SLA │ 40px
├──────────────┬────────────────────────────────────────────────┬──────────────┤
│ B · COLA     │                                                │ D · DETALLE  │
│ incidentes   │            C · MAPA TÁCTICO                    │ incidente    │
│ por prioridad│   incidentes · unidades · perímetros ·         │ unidades     │
│              │   refugios · bloqueos · leyenda                │ bitácora     │
│ 320px        │   1fr                                          │ asesor IA    │
│ colapsable [ │                                                │ 380px  ]     │
├──────────────┴────────────────────────────────────────────────┴──────────────┤
│ E · TABLERO DE UNIDADES  M-01 ●DISP │ M-12 ▲RUTA 06:12 │ P-01 ◆ESC │ B-01 ●DISP │ 96px
└──────────────────────────────────────────────────────────────────────────────┘
```

**Implementación**

- `grid-template-areas` sobre `100vh` (`h-dvh overflow-hidden` en el root).
- Las columnas B y D colapsan a 40px (rail con iconos) mediante `data-colapsado`.
- Solo `ColaIncidentes`, `PanelDetalle` y la bitácora llevan `overflow-y-auto` interno.
- El tablero E hace scroll horizontal solo si hay más de 12 unidades; por defecto se ajusta en chips de ancho fijo.
- Ancho mínimo soportado: 1280×720. Por debajo, D se superpone al mapa como drawer.

### 2.2 Cuadrantes

| Zona | Componente | Contenido | Reglas |
|---|---|---|---|
| A | `BarraEstado` | Reloj con segundos (hora del servidor corregida), turno, operador, estado Realtime, contador de SLA vencidos, botones de turno y salir | Altura fija, sin scroll. El contador de SLA es clicable y filtra la cola |
| B | `ColaIncidentes` | Una fila por incidente: prioridad, `#código`, tipo, tiempo abierto, nº de unidades y badge de duplicados | Orden: P1→P4, luego antigüedad. Los resueltos van a la pestaña "Cerrados". Bandeja de llamadas sin vincular arriba, plegable |
| C | `MapaTactico` | Basemap desaturado, capas tácticas y leyenda | El color se reserva a la semántica. Al seleccionar un incidente se centra y se dibuja su perímetro |
| D | `PanelDetalle` | Ficha, unidades asignadas con SLA, análisis del perímetro, llamadas vinculadas, bitácora y `TarjetaAsesor` | DESPACHAR solo existe aquí, ligado al incidente seleccionado |
| E | `TableroUnidades` | Chip por unidad: indicativo, tipo, estado y cronómetro | Parpadeo y borde crítico si el SLA está vencido. Clic = seleccionar la unidad en el mapa |

### 2.3 Atajos de teclado

| Tecla | Acción |
|---|---|
| `F2` | Registrar llamada (drawer sobre D) |
| `[` / `]` | Colapsar o expandir la cola o el detalle |
| `J` / `K` | Siguiente o anterior incidente en la cola |
| `D` | Despachar la unidad sugerida o enfocar la lista de unidades |
| `A` | Invocar el Asesor IA para el incidente seleccionado |
| `Esc` | Cerrar el drawer o cancelar el trazado |
| `F1` | Hoja de atajos |

Los atajos se desactivan dentro de inputs, salvo `Esc` y `Ctrl+Enter`.

### 2.4 Correcciones de la interfaz actual incluidas

- **Línea de tiempo:** fecha visible cuando cambia el día, orden cronológico estricto por `creado_en` del servidor y autor o origen en cada evento.
- **Incidentes resueltos:** dejan la cola activa y se muestran atenuados.
- **Indicativos:** se muestran completos (`M-01`, `M-12`) en monoespaciada, sin truncar.
- **Basemap:** pasa a estilo desaturado por tema (crema/carbón) y deja de usar los colores de OSM.

---

## 3. Funcionalidades CAD

### 3.1 Registro de llamada y detección de duplicados

**Flujo**

1. `F2` abre `FormularioLlamada` con los campos:
   - canal (`123 | VHF | SENSOR | PRESENCIAL`);
   - reportante y callback;
   - tipo;
   - prioridad;
   - ubicación (clic en el mapa o coordenadas);
   - narrativa.
2. Mientras el operador edita la ubicación o el tipo, `domain/duplicados.ts` evalúa los incidentes activos.
3. Si hay candidatos, aparece el aviso **"Posible duplicado de #A3F (120 m, hace 4 min)"** con dos opciones:
   - **[VINCULAR]**: la llamada se asocia al incidente existente y suma al contador.
   - **[CREAR NUEVO]**: se crea un incidente nuevo y la decisión queda en la bitácora.

**Algoritmo** (puro y determinista)

`puntaje = 0.5·proximidad + 0.3·recencia + 0.2·coincidenciaTipo`

| Componente | Cálculo |
|---|---|
| `proximidad` | `max(0, 1 − d / radioMax)`, con `radioMax = 500 m` por defecto y `d` en metros (Haversine) |
| `recencia` | `max(0, 1 − Δt / ventana)`, con `ventana = 30 min` |
| `coincidenciaTipo` | 1 si el tipo es igual, 0.5 si es de la misma familia (p. ej. INCENDIO / EXPLOSION), 0 si no |

Solo se consideran incidentes **no resueltos**. Se sugiere un candidato si su puntaje es ≥ 0.6, y se muestran como máximo 3, ordenados de mayor a menor.

### 3.2 Perímetros de riesgo automáticos

- **Generación:** al crear un incidente (o al pedirlo con el botón "Perímetro"), `domain/perimetro.ts` genera tres anillos concéntricos con `@turf/circle` sobre la ubicación:

  | Anillo | Radio por defecto |
  |---|---|
  | `CALIENTE` | 100 m |
  | `TIBIA` | 300 m |
  | `EVACUACION` | 500 m |

- **Radios por tipo:** los radios salen de `PROTOCOLOS_PERIMETRO` en `@argos/shared` (tabla por tipo). Los tres valores anteriores son el valor por defecto obligatorio.
- **Análisis espacial** (`analizarPerimetro`):
  - **Refugios:** se clasifican por anillo. Un refugio dentro de `CALIENTE` o `TIBIA` se marca **no apto para recepción**.
  - **Unidades:** se detectan las que están dentro de `CALIENTE`, lo que genera una alerta de seguridad.
  - **Bloqueos:** se detectan los `zonas_publicas` que intersectan los anillos.
- **Persistencia:** el anillo exterior se persiste como `zona_riesgo` del incidente, aprovechando el trigger existente. Los tres anillos se guardan en `incidentes.perimetro` (jsonb).
- **Corrección manual:** el trazado con mapbox-gl-draw se mantiene. Un polígono manual reemplaza el anillo `EVACUACION` y se marca como `origen: 'MANUAL'`.

### 3.3 Control de tiempos de respuesta (SLA)

**Ciclo de vida del recurso** (extiende `TRANSICIONES_RECURSO`)

```
DISPONIBLE → ASIGNADO → EN_RUTA → EN_ESCENA → DISPONIBLE
     ↘                                   ↗
      INOPERATIVO ←──── (desde cualquiera) ────→ DISPONIBLE
```

**Registro de tiempos:** cada transición se inserta en `eventos_recurso` con hora del servidor.

**Umbrales por prioridad** (`SLA_POR_PRIORIDAD`)

| Prioridad | Asignado→En ruta | Asignado→En escena | Alerta previa |
|---|---|---|---|
| P1 | 2 min | 10 min | 80 % |
| P2 | 3 min | 15 min | 80 % |
| P3 | 5 min | 25 min | 80 % |
| P4 | 10 min | 45 min | 80 % |

**Cálculo:** `domain/sla.ts` es una función pura `(eventos, prioridad, ahora) → EstadoSla`. El hook `useReloj` (1 Hz) recalcula sin consultar la base.

**Presentación**

| Estado | Visualización |
|---|---|
| `EN_TIEMPO` | Cronómetro neutro |
| `ALERTA` | Color ámbar |
| `VENCIDO` | Parpadeo de 1 Hz en rojo crítico más contador en la barra de estado |

Con `prefers-reduced-motion`, el parpadeo se sustituye por un borde grueso con el patrón de rayas del sistema.

---

## 4. Asesor de Despacho Táctico (IA)

### 4.1 Flujo human-in-the-loop

1. El operador pulsa **[ASESOR]** (o `A`) con un incidente seleccionado.
2. El frontend arma un `SnapshotAsesor` (§5.4) a partir del estado en memoria. **No se envían datos personales del reportante** (nombre ni teléfono).
3. `invoke('asesor_despacho', { snapshot })`: el backend Rust llama a la API de Anthropic.
4. La `TarjetaAsesor` muestra:
   - las unidades recomendadas con su ETA estimada;
   - la justificación táctica;
   - el perímetro sugerido (previsualizado en el mapa con trazo discontinuo);
   - las advertencias y la confianza.
5. **[APLICAR SUGERENCIA]** abre una confirmación con cada acción en una línea marcable (despachar M-12 ☑, despachar B-01 ☑, aplicar perímetro ☑).
6. Las acciones confirmadas se ejecutan con **las mismas funciones** que el despacho manual y se registran en la bitácora con `origen: 'IA'` y el `idRecomendacion`.
7. **[DESCARTAR]** registra el rechazo, que sirve para la evaluación posterior.

### 4.2 Servicio seguro en Tauri

- **Comando y llamada:** el comando `asesor_despacho` (en `src-tauri/src/asesor/mod.rs`) usa `reqwest` contra `https://api.anthropic.com/v1/messages`.
- **API key:**
  - Se lee del llavero del sistema operativo (crate `keyring`), con `ARGOS_ANTHROPIC_API_KEY` como respaldo en desarrollo.
  - Nunca se expone por IPC ni en `import.meta.env`.
- **Salida estructurada:**
  - Se fuerza una *tool* única `recomendar_despacho` con `input_schema` JSON (§5.5) y `tool_choice: { type: "tool", name: "recomendar_despacho" }`.
  - El modelo es configurable (`ARGOS_ASESOR_MODELO`).
- **Validación doble:**
  - **Rust:** se deserializa con `serde` (`deny_unknown_fields`).
  - **TS:** `validarRecomendacion()` verifica que cada `idRecurso` exista en el snapshot y esté `DISPONIBLE`, y que los radios sean positivos y crecientes.
  - Si alguna validación falla, se descarta la respuesta y se muestra un error, sin aplicar nada.
- **Robustez:**
  - Timeout de 20 s y un reintento ante 429/5xx.
  - Sin red o sin clave, la tarjeta muestra "Asesor no disponible" y la consola sigue operando con normalidad.
- **CSP de Tauri:** el frontend no necesita conexión a `api.anthropic.com`. El tráfico sale solo desde Rust.
- **Prompt de sistema:** está versionado en `src-tauri/src/asesor/prompt.md`. Establece:
  - recomendar solo unidades presentes en el snapshot;
  - priorizar la seguridad (ninguna unidad sin equipo adecuado en `CALIENTE`);
  - preferir refugios fuera del perímetro y con cupo;
  - responder en español.

---

## 5. Contratos de datos (TypeScript, `@argos/shared`)

### 5.1 Llamadas y duplicados — `packages/shared/src/llamada.ts`

```ts
export const CANALES_LLAMADA = ['123', 'VHF', 'SENSOR', 'PRESENCIAL'] as const;
export type CanalLlamada = (typeof CANALES_LLAMADA)[number];

export const PRIORIDADES = ['P1', 'P2', 'P3', 'P4'] as const;
export type Prioridad = (typeof PRIORIDADES)[number];

export interface Coordenada { lng: number; lat: number }

export interface Llamada {
  id: string;
  canal: CanalLlamada;
  tipo: TipoEmergencia;
  prioridad: Prioridad;
  ubicacion: Coordenada;
  narrativa: string;
  reportante: string | null;
  callback: string | null;
  incidenteId: string | null;      // null = sin vincular
  operadorId: string;
  creadoEn: string;                // ISO 8601, hora del servidor
}

export type NuevaLlamada = Omit<Llamada, 'id' | 'creadoEn' | 'operadorId' | 'incidenteId'>;

export interface CandidatoDuplicado {
  incidenteId: string;
  codigo: string;
  distanciaM: number;
  minutosDesde: number;
  puntaje: number;                 // 0..1
}

export interface ParametrosDuplicados {
  radioMaxM: number;               // 500
  ventanaMin: number;              // 30
  umbral: number;                  // 0.6
  maxCandidatos: number;           // 3
}
```

### 5.2 Perímetros — `packages/shared/src/perimetro.ts`

```ts
export const ANILLOS = ['CALIENTE', 'TIBIA', 'EVACUACION'] as const;
export type Anillo = (typeof ANILLOS)[number];

export type RadiosPerimetro = Readonly<Record<Anillo, number>>; // metros, estrictamente crecientes
export const RADIOS_POR_DEFECTO: RadiosPerimetro = { CALIENTE: 100, TIBIA: 300, EVACUACION: 500 };
export declare const PROTOCOLOS_PERIMETRO: Readonly<Record<TipoEmergencia, RadiosPerimetro>>;

export interface PerimetroRiesgo {
  centro: Coordenada;
  radios: RadiosPerimetro;
  origen: 'AUTO' | 'MANUAL' | 'IA';
  poligonoManual: GeoJSON.Polygon | null;
}

export interface AnalisisPerimetro {
  refugios: Array<{ id: string; nombre: string; anillo: Anillo | 'FUERA'; apto: boolean }>;
  unidadesEnZonaCaliente: string[];  // ids de recurso → alerta de seguridad
  bloqueosAfectados: string[];       // ids de zonas_publicas
}
```

### 5.3 Ciclo de vida y SLA — `packages/shared/src/sla.ts`

```ts
export const ESTADOS_RECURSO = ['DISPONIBLE', 'ASIGNADO', 'EN_RUTA', 'EN_ESCENA', 'INOPERATIVO'] as const;
export type EstadoRecurso = (typeof ESTADOS_RECURSO)[number];

export interface EventoRecurso {
  id: string;
  recursoId: string;
  incidenteId: string | null;
  desde: EstadoRecurso;
  hacia: EstadoRecurso;
  origen: 'MANUAL' | 'IA' | 'SISTEMA';
  creadoEn: string;
}

export interface UmbralSla { aEnRutaSeg: number; aEnEscenaSeg: number; alertaPrevia: number }
export declare const SLA_POR_PRIORIDAD: Readonly<Record<Prioridad, UmbralSla>>;

export type NivelSla = 'EN_TIEMPO' | 'ALERTA' | 'VENCIDO' | 'NO_APLICA';

export interface EstadoSla {
  recursoId: string;
  hito: 'EN_RUTA' | 'EN_ESCENA' | null;  // próximo hito esperado
  transcurridoSeg: number;
  limiteSeg: number | null;
  nivel: NivelSla;
}
```

### 5.4 Snapshot del Asesor (entrada) — `packages/shared/src/asesor.ts`

```ts
export interface SnapshotAsesor {
  version: 1;
  generadoEn: string;
  incidente: {
    id: string; codigo: string; tipo: TipoEmergencia; prioridad: Prioridad;
    ubicacion: Coordenada; descripcion: string; llamadasVinculadas: number;
    minutosAbierto: number; perimetroActual: RadiosPerimetro | null;
  };
  recursos: Array<{
    id: string; indicativo: string; tipo: TipoRecurso; estado: EstadoRecurso;
    ubicacion: Coordenada; distanciaM: number;   // precalculada en el cliente
  }>;
  refugios: Array<{
    id: string; nombre: string; ubicacion: Coordenada;
    ocupacion: number; capacidad: number; anillo: Anillo | 'FUERA';
  }>;
}
```

### 5.5 Recomendación (salida JSON) — `packages/shared/src/asesor.ts`

```ts
export interface RecomendacionAsesor {
  idRecomendacion: string;               // UUID asignado en Rust
  unidades: Array<{
    idRecurso: string;                   // debe existir en el snapshot y estar DISPONIBLE
    rol: string;                         // p. ej. "Control de fuga", "Atención prehospitalaria"
    etaMin: number;
  }>;
  justificacion: string;                 // ≤ 600 caracteres
  perimetroSugerido: RadiosPerimetro;
  refugioSugeridoId: string | null;
  advertencias: string[];
  confianza: 'ALTA' | 'MEDIA' | 'BAJA';
}

export type ResultadoAsesor =
  | { ok: true; recomendacion: RecomendacionAsesor }
  | { ok: false; error: 'SIN_CLAVE' | 'SIN_RED' | 'TIMEOUT' | 'RESPUESTA_INVALIDA' | 'API'; detalle: string };
```

El `input_schema` de la tool `recomendar_despacho` se genera a partir de este contrato y se guarda en `src-tauri/src/asesor/schema.json`. La prueba F3-T3 verifica que estén sincronizados.

---

## 6. Plan de ejecución en 3 fases

**Convenciones**

- **Ramas:** GitFlow, una rama por fase desde `main` y un PR por fase.
- **Commits:** Conventional Commits, en español, atómicos. Cada uno pasa `npm run check` y termina con `Co-Authored-By`.
- **Cuándo se commitea:** al completar cada funcionalidad o cada paso del plan, nunca en lote al final de la fase.
- **Total planificado:** 56 commits de código (3 de preparación + 17 de F1 + 20 de F2 + 16 de F3), más las operaciones de push, PR y merge.

### Fase 0 — Preparación (`feat/design-system-argos` → `main`)

| # | Commit |
|---|---|
| P-01 | `chore(desktop): normaliza saltos de línea de tema.ts y añade .gitattributes (eol=lf)` |
| P-02 | `chore(tauri): ignora src-tauri/gen/schemas generados` |
| P-03 | `docs: añade ROADMAP_CAD.md con el pivote a consola CAD de escritorio` |
| P-04 | Push de la rama y PR del design system hacia `main` (merge commit) |
| P-05 | `chore: crea la rama feat/cad-fase1-grilla desde main` (primer commit vacío no; se inicia con F1-01) |

> P-04 y P-05 son operaciones de Git, no commits de código. El conteo de commits de código efectivos de la fase 0 es 3.

---

### Fase 1 — Pivote a escritorio y grilla táctica

Rama: `feat/cad-fase1-grilla`

#### Archivos afectados

| Acción | Ruta |
|---|---|
| Mover | `apps/web/` → `archive/web/` (fuera de `workspaces`) |
| Modificar | `package.json` raíz (workspaces y scripts `test:load`), `vitest.workspace.ts` o la config de proyectos, `tsconfig` de referencias |
| Modificar | `SPEC.md`, `CLAUDE.md`, `README.md` |
| Crear | `supabase/migrations/0005_pivote_escritorio.sql` |
| Modificar | `supabase/rls.test.ts`, `supabase/reportes.test.ts`, `supabase/seed.sql`, `supabase/reset.sql` |
| Crear | `apps/desktop/src/layout/GrillaTactica.tsx` (+ `.css`, `.test.tsx`) |
| Crear | `apps/desktop/src/layout/BarraEstado.tsx`, `ColaIncidentes.tsx`, `PanelDetalle.tsx`, `TableroUnidades.tsx` (+ pruebas) |
| Crear | `apps/desktop/src/hooks/useAtajos.ts`, `useReloj.ts`, `usePanelColapsable.ts` (+ pruebas) |
| Crear | `apps/desktop/src/domain/cola.ts` (orden y filtros, puro) |
| Modificar | `apps/desktop/src/domain/timeline.ts` (orden por `creadoEn`, cortes por fecha, autor) |
| Modificar | `apps/desktop/src/App.tsx` (reemplaza `PanelMesa`/paneles flotantes por la grilla) |
| Modificar | `apps/desktop/src/MapView.tsx` → `layout/MapaTactico.tsx` (basemap desaturado, marcadores de unidades, leyenda) |
| Crear | `packages/ui/src/UnitChip/`, `packages/ui/src/RailColapsable/` (componentes con prueba) |
| Eliminar | `apps/desktop/src/PanelMesa.tsx` (sus partes se reparten en cola y detalle) |

#### Migración 0005 (idempotente)

- Renombra `reportes_ciudadanos` → `llamadas`. Añade `canal`, `prioridad`, `narrativa`, `callback`, `incidente_id` (FK) y `operador_id`.
- **Elimina la política de inserción anónima** (ya no hay portal). Solo `es_operador()` puede leer o escribir `llamadas`.
- Revoca la lectura anónima de `zonas_publicas` y `zonas_riesgo`. El bucket `reportes` queda en solo lectura para operadores.
- Actualiza la publicación Realtime.

#### Commits (17)

| # | Commit |
|---|---|
| F1-01 | `chore: archiva apps/web en archive/web y la retira de los workspaces` |
| F1-02 | `chore: elimina test:load y la config de Vitest del portal` |
| F1-03 | `docs: actualiza SPEC.md y CLAUDE.md al pivote 100 % escritorio` |
| F1-04 | `feat(db): migración 0005 renombra reportes a llamadas y elimina el acceso anónimo` |
| F1-05 | `test(db): actualiza rls.test.ts para verificar que no existen políticas anon` |
| F1-06 | `chore(db): adapta seed.sql y reset.sql al modelo de llamadas` |
| F1-07 | `feat(ui): componente UnitChip con estado, indicativo y cronómetro` |
| F1-08 | `feat(ui): componente RailColapsable` |
| F1-09 | `feat(desktop): hook useReloj con offset de hora del servidor` |
| F1-10 | `feat(desktop): hook useAtajos con mapa de teclas y exclusión de inputs` |
| F1-11 | `feat(desktop): GrillaTactica con áreas fijas y paneles colapsables` |
| F1-12 | `feat(desktop): BarraEstado con reloj, turno, operador y estado Realtime` |
| F1-13 | `feat(domain): orden y filtros de la cola de incidentes` |
| F1-14 | `feat(desktop): ColaIncidentes compacta con pestaña de cerrados` |
| F1-15 | `feat(desktop): PanelDetalle con despacho contextual al incidente` |
| F1-16 | `feat(desktop): TableroUnidades fijo y MapaTactico con basemap desaturado y leyenda` |
| F1-17 | `fix(domain): línea de tiempo con orden cronológico, cortes por fecha y autor` |

#### Criterios de verificación

| ID | Criterio | Tipo |
|---|---|---|
| F1-T1 | `npm run check` sin referencias a `@argos/web`; `apps/web` no existe en los workspaces | CI |
| F1-T2 | `rls.test.ts`: ninguna política de 0005 menciona el rol `anon`; `llamadas` exige `es_operador()` | Unitario (SQL estático) |
| F1-T3 | `GrillaTactica.test.tsx`: renderiza las 5 áreas; `document.documentElement.scrollHeight === innerHeight` en jsdom simulado; colapsar B/D cambia `data-colapsado` | Componente |
| F1-T4 | `useAtajos.test.ts`: `[`, `]`, `J`, `K` y `F2` disparan sus acciones; no se disparan dentro de `<input>`; `Esc` sí | Hook |
| F1-T5 | `cola.test.ts`: orden P1→P4 y luego antigüedad; los resueltos se excluyen de "activos" | Dominio |
| F1-T6 | `timeline.test.ts`: eventos de días distintos ordenados y con separador de fecha; el caso de la captura (14:02 / 15:48 / 10:29) queda en orden | Dominio |
| F1-T7 | `PanelDetalle.test.tsx`: DESPACHAR solo aparece con incidente seleccionado y llama a la mutación con su `incidenteId` | Componente |
| F1-T8 | Manual: la Mesa en modo demo, crema y carbón, a 1280×720 y 1920×1080, sin scroll de página | Manual |

---

### Fase 2 — Lógica CAD

Rama: `feat/cad-fase2-logica`

#### Archivos afectados

| Acción | Ruta |
|---|---|
| Crear | `packages/shared/src/llamada.ts`, `perimetro.ts`, `sla.ts` (+ pruebas); reexportar en `index.ts` |
| Modificar | `packages/shared/src/recurso.ts` (`TRANSICIONES_RECURSO` con el nuevo ciclo) |
| Crear | `supabase/migrations/0006_cad_eventos_y_perimetro.sql` |
| Crear | `supabase/eventos.test.ts` |
| Crear | `apps/desktop/src/domain/geo.ts` (Haversine), `duplicados.ts`, `perimetro.ts`, `sla.ts` (+ pruebas) |
| Crear | `apps/desktop/src/cad/FormularioLlamada.tsx`, `AvisoDuplicado.tsx`, `AnalisisPerimetro.tsx`, `CronometroSla.tsx` (+ pruebas) |
| Crear | `apps/desktop/src/hooks/useSla.ts`, `useAccionesLlamada.ts` |
| Modificar | `services/supabaseClient.ts` y `servicioDemo` (llamadas, eventos_recurso, perímetro) |
| Modificar | `layout/MapaTactico.tsx` (capas de anillos), `BarraEstado.tsx` (contador SLA), `TableroUnidades.tsx`, `PanelDetalle.tsx` |
| Dependencias | `@turf/circle`, `@turf/boolean-point-in-polygon`, `@turf/boolean-intersects`, `@turf/distance` (solo módulos usados) |

#### Migración 0006 (idempotente)

- `eventos_recurso`:
  - `id`, `recurso_id`, `incidente_id`, `desde`, `hacia`, `origen` y `creado_en default now()`.
  - Solo inserción: no hay políticas de UPDATE ni DELETE.
  - Un trigger valida la transición contra la tabla de transiciones permitidas.
- `incidentes`: añade `prioridad`, `perimetro jsonb` y `perimetro_origen`.
- `recursos_operativos.estado`: el check pasa a los 5 estados nuevos (migra `Despachado` → `ASIGNADO` y `En escena` → `EN_ESCENA`).
- Una RPC `transicionar_recurso(p_id, p_hacia, p_incidente, p_origen)` actualiza el estado e inserta el evento en una sola transacción.

#### Commits (20)

| # | Commit |
|---|---|
| F2-01 | `feat(shared): prioridades P1–P4 y canales de llamada` |
| F2-02 | `feat(shared): contratos Llamada, CandidatoDuplicado y ParametrosDuplicados` |
| F2-03 | `feat(shared): ciclo de vida CAD de recursos y tabla de transiciones` |
| F2-04 | `feat(shared): SLA_POR_PRIORIDAD y contrato EstadoSla` |
| F2-05 | `feat(shared): anillos, radios por defecto y PROTOCOLOS_PERIMETRO` |
| F2-06 | `feat(db): migración 0006 con eventos_recurso, prioridad y perímetro de incidente` |
| F2-07 | `feat(db): RPC transicionar_recurso atómica con evento` |
| F2-08 | `test(db): eventos_recurso solo inserción y RPC con security invoker` |
| F2-09 | `feat(domain): distancia Haversine en geo.ts` |
| F2-10 | `feat(domain): puntaje y búsqueda de candidatos duplicados` |
| F2-11 | `feat(desktop): FormularioLlamada (F2) con teclado primero` |
| F2-12 | `feat(desktop): AvisoDuplicado con vincular o crear nuevo` |
| F2-13 | `feat(desktop): vinculación de llamadas e indicador de duplicados en la cola` |
| F2-14 | `feat(domain): generación de anillos de perímetro con turf` |
| F2-15 | `feat(domain): análisis espacial de refugios, unidades y bloqueos` |
| F2-16 | `feat(desktop): capas de anillos en el mapa y panel AnalisisPerimetro` |
| F2-17 | `feat(desktop): corrección manual del perímetro con mapbox-gl-draw` |
| F2-18 | `feat(domain): cálculo puro de EstadoSla por recurso` |
| F2-19 | `feat(desktop): CronometroSla en tablero y detalle con parpadeo accesible` |
| F2-20 | `feat(desktop): alertas SLA en la barra de estado con filtro de cola` |

#### Criterios de verificación

| ID | Criterio | Tipo |
|---|---|---|
| F2-T1 | `geo.test.ts`: distancia conocida de Pasto (Plaza de Nariño ↔ Estadio Libertad) con error < 1 % | Dominio |
| F2-T2 | `duplicados.test.ts`: mismo tipo a 120 m y 4 min → puntaje ≥ 0.6; a 800 m → excluido; incidente resuelto → excluido; distinto tipo no familiar a 50 m → < 0.6; máximo 3 resultados ordenados | Dominio |
| F2-T3 | `perimetro.test.ts`: genera 3 anillos con radios 100/300/500 (área ≈ πr², tolerancia del 2 %); los radios no crecientes lanzan error; un refugio a 250 m queda en `TIBIA` y `apto: false`; una unidad a 50 m aparece en `unidadesEnZonaCaliente` | Dominio |
| F2-T4 | `sla.test.ts` (reloj inyectado): P1 asignado hace 90 s → `EN_TIEMPO`; 100 s → `ALERTA` (80 % de 120); 121 s → `VENCIDO`; en escena → `NO_APLICA` | Dominio |
| F2-T5 | `recurso.test.ts`: transiciones válidas aceptadas; `DISPONIBLE → EN_ESCENA` rechazada | Dominio |
| F2-T6 | `eventos.test.ts`: 0006 no crea políticas UPDATE/DELETE en `eventos_recurso`; la RPC es `security invoker` y solo para `authenticated` | SQL estático |
| F2-T7 | `FormularioLlamada.test.tsx`: Ctrl+Enter crea la llamada; con candidatos aparece `AvisoDuplicado`; VINCULAR llama a la mutación con el `incidenteId` | Componente |
| F2-T8 | `CronometroSla.test.tsx`: `data-nivel="VENCIDO"` aplica la clase de parpadeo; con `prefers-reduced-motion` usa el patrón estático | Componente |
| F2-T9 | Manual: registrar 3 llamadas sobre el mismo punto → 1 incidente con 3 llamadas vinculadas; despachar una unidad P1 y dejar vencer el SLA en modo demo con reloj acelerado | Manual |

---

### Fase 3 — Asesor de Despacho Táctico (IA)

Rama: `feat/cad-fase3-asesor`

#### Archivos afectados

| Acción | Ruta |
|---|---|
| Crear | `packages/shared/src/asesor.ts` (+ prueba) |
| Crear | `apps/desktop/src-tauri/src/asesor/mod.rs` (comando), `cliente.rs` (HTTP), `esquema.rs` (tipos serde), `clave.rs` (llavero), `prompt.md`, `schema.json` |
| Modificar | `apps/desktop/src-tauri/Cargo.toml` (`reqwest` con rustls, `serde`, `keyring`, `uuid`, `tokio`), `main.rs` (registro del comando), `capabilities/*.json` |
| Crear | `apps/desktop/src/domain/asesor.ts` (`construirSnapshot`, `validarRecomendacion`, `planDesdeRecomendacion`) (+ pruebas) |
| Crear | `apps/desktop/src/services/asesorService.ts` (wrapper de `invoke` + implementación demo) |
| Crear | `apps/desktop/src/asesor/TarjetaAsesor.tsx`, `ConfirmacionPlan.tsx` (+ pruebas) |
| Modificar | `layout/PanelDetalle.tsx` (tarjeta), `layout/MapaTactico.tsx` (previsualización del perímetro sugerido), `hooks/useAtajos.ts` (`A`) |
| Modificar | `README.md` (configurar la clave en el llavero), `CLAUDE.md` (regla: nunca exponer la clave al frontend) |

#### Commits (16)

| # | Commit |
|---|---|
| F3-01 | `feat(shared): contratos SnapshotAsesor, RecomendacionAsesor y ResultadoAsesor` |
| F3-02 | `feat(domain): construirSnapshot sin datos personales del reportante` |
| F3-03 | `feat(domain): validarRecomendacion contra el snapshot` |
| F3-04 | `feat(domain): planDesdeRecomendacion a acciones confirmables` |
| F3-05 | `feat(tauri): tipos serde y schema.json de la tool recomendar_despacho` |
| F3-06 | `feat(tauri): lectura de la API key desde el llavero del sistema` |
| F3-07 | `feat(tauri): cliente Anthropic con tool_choice forzado, timeout y reintento` |
| F3-08 | `feat(tauri): comando asesor_despacho con errores tipados` |
| F3-09 | `docs(tauri): prompt de sistema versionado del asesor` |
| F3-10 | `feat(desktop): asesorService con invoke y modo demo determinista` |
| F3-11 | `feat(desktop): TarjetaAsesor con estados cargando, resultado y error` |
| F3-12 | `feat(desktop): previsualización del perímetro sugerido en el mapa` |
| F3-13 | `feat(desktop): ConfirmacionPlan con acciones marcables y APLICAR SUGERENCIA` |
| F3-14 | `feat(desktop): bitácora con origen IA e idRecomendacion; registro de descartes` |
| F3-15 | `feat(desktop): atajo A para invocar el asesor` |
| F3-16 | `docs: guía de configuración del asesor y reglas de seguridad en CLAUDE.md` |

#### Criterios de verificación

| ID | Criterio | Tipo |
|---|---|---|
| F3-T1 | `asesor.test.ts` (domain): el snapshot no contiene `reportante` ni `callback`; las distancias están precalculadas; solo incluye recursos no `INOPERATIVO` | Dominio |
| F3-T2 | `validarRecomendacion`: rechaza un `idRecurso` inexistente, un recurso no disponible, radios no crecientes y una justificación de más de 600 caracteres; acepta una respuesta válida | Dominio |
| F3-T3 | `schema.test.ts`: `schema.json` coincide con `RecomendacionAsesor` (claves y obligatorios) | Contrato |
| F3-T4 | `cargo test` en `src-tauri`: deserializa la respuesta de ejemplo; `deny_unknown_fields` rechaza claves extra; un 429 y luego un 200 → reintento exitoso (servidor mock); sin clave → `SIN_CLAVE` | Rust |
| F3-T5 | `TarjetaAsesor.test.tsx`: con `ok: false` muestra "Asesor no disponible" y no bloquea DESPACHAR; con `ok: true` muestra unidades, justificación y advertencias | Componente |
| F3-T6 | `ConfirmacionPlan.test.tsx`: solo ejecuta las acciones marcadas; usa las mismas mutaciones que el despacho manual con `origen: 'IA'` | Componente |
| F3-T7 | Seguridad: `grep -r "ANTHROPIC" apps/desktop/src dist/` sin coincidencias; la CSP no incluye `api.anthropic.com` | CI / script |
| F3-T8 | Manual: con la clave real, incidente P1 "Fuga de gas" → recomendación coherente en menos de 20 s; aplicar parcialmente (1 de 2 unidades) queda reflejado en la bitácora | Manual |

---

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Migrar `estado` de recursos rompe datos reales | 0006 mapea valores antiguos y falla explícitamente ante valores desconocidos, igual que 0003 |
| La IA recomienda unidades inexistentes u ocupadas | Validación doble (Rust + TS) contra el snapshot; las acciones solo se ejecutan tras confirmación |
| Latencia o caída de la API | Timeout de 20 s, estado "no disponible" y la consola operable sin IA |
| Fuga de la API key | Llavero del sistema operativo, solo backend Rust, test F3-T7 en CI |
| Parpadeo y fatiga visual o accesibilidad | 1 Hz máximo, solo en `VENCIDO`, alternativa con `prefers-reduced-motion` |
| Falsos positivos de duplicados | El operador decide siempre (VINCULAR o CREAR NUEVO); los parámetros están en `ParametrosDuplicados` |
| Rendimiento del mapa con muchas capas | Una fuente GeoJSON por categoría y `setData` incremental; turf solo sobre el incidente seleccionado |

## 8. Definición de terminado (por fase)

- Todos los commits de la fase están en su rama, con `npm run check` en verde en cada uno.
- Los criterios de verificación automáticos pasan y los manuales están documentados en la descripción del PR (con capturas en crema y carbón).
- SPEC.md, CLAUDE.md y README.md reflejan lo implementado.
- El PR hacia `main` está revisado y fusionado antes de abrir la siguiente fase.
