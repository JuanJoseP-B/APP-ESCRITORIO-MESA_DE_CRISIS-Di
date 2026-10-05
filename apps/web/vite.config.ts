import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // El worker de MapLibre 6 es un módulo ES con imports (ver src/mapaWorker.ts).
  worker: { format: 'es' },
});
