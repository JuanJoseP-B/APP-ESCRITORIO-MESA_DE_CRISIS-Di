import { configDefaults, defineConfig } from 'vitest/config';

// `archive/` guarda código fuera de los workspaces (portal web archivado): `npm run check` no lo ejecuta.
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, 'archive/**'] },
});
