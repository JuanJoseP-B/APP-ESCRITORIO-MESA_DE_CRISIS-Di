import { configDefaults, defineConfig } from 'vitest/config';

// `npm run check` omite el perfil pesado y lo archivado (`archive/`: código fuera de los workspaces).
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '**/*.load.test.ts', 'archive/**'] },
});
