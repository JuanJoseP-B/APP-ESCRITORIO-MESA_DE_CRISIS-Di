import { setWorkerUrl } from 'maplibre-gl';
import urlWorker from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';

// MapLibre 6 deduce la URL de su worker a partir de `import.meta.url`; al empaquetar con Vite esa
// ruta deja de existir (404) y sin worker no se procesa ninguna fuente GeoJSON: ni incidentes, ni
// zonas, ni la herramienta de dibujo. Se le indica el worker que Vite sí empaqueta y sirve.
setWorkerUrl(urlWorker);
