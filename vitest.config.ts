import { configDefaults, defineConfig } from 'vitest/config';

// `archive/` guarda código fuera de los workspaces (portal web archivado): `npm run check` no lo ejecuta.
// Por defecto Vitest vacía los CSS; los importados con `?raw` se dejan pasar para que las pruebas de
// componentes puedan inspeccionar su hoja de estilos (p. ej. que no haya colores sueltos).
export default defineConfig({
  test: {
    exclude: [...configDefaults.exclude, 'archive/**'],
    css: { include: [/\.css\?raw$/] },
  },
});
