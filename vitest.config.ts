import { configDefaults, defineConfig } from 'vitest/config';

// `npm run check` omite el perfil pesado; se ejecuta con `npm run test:load` (vitest.load.config.ts).
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, '**/*.load.test.ts'] },
});
