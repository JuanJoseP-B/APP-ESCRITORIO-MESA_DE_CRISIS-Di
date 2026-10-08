import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const leerJson = (ruta: string): Record<string, unknown> =>
  JSON.parse(readFileSync(new URL(ruta, import.meta.url), 'utf8')) as Record<string, unknown>;

describe('pivote a escritorio (F1-T1)', () => {
  const raiz = leerJson('./package.json');

  it('los workspaces no incluyen el portal web archivado', () => {
    expect(raiz['workspaces']).toEqual(['apps/*', 'packages/*']);
    expect(existsSync(new URL('./apps/web', import.meta.url))).toBe(false);
    expect(existsSync(new URL('./archive/web/package.json', import.meta.url))).toBe(true);
  });

  it('los scripts de la raíz no referencian @argos/web ni apps/web', () => {
    expect(JSON.stringify(raiz['scripts'])).not.toMatch(/apps\/web|@argos\/web/);
  });

  it('no queda el perfil de carga Realtime del portal (test:load)', () => {
    expect(raiz['scripts']).not.toHaveProperty('test:load');
    expect(existsSync(new URL('./vitest.load.config.ts', import.meta.url))).toBe(false);
  });
});
