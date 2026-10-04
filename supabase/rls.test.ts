import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Validación estática de las migraciones RLS (no hay Postgres en CI): tanto la instalación limpia (0001)
 * como la que alinea una base creada a mano (0002) deben dejar el mismo modelo de seguridad.
 * La verificación contra una base real está descrita en supabase/README.md.
 */
const MIGRACIONES = ['0001_esquema_y_rls.sql', '0002_alinear_esquema_y_rls.sql'];
const TABLAS = ['incidentes', 'reportes_ciudadanos', 'recursos_operativos', 'zonas_publicas', 'zonas_riesgo'];

const concedeAAnon = (s: string) => /^grant .* to [^;]*\banon\b/i.test(s) || /^grant .* to [^;]*\bpublic\b/i.test(s);

describe.each(MIGRACIONES)('migración %s', (archivo) => {
  const sql = readFileSync(new URL(`./migrations/${archivo}`, import.meta.url), 'utf-8');

  /** Sentencias SQL sin comentarios de línea. */
  const sentencias = sql
    .replace(/--.*$/gm, '')
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const sobre = (tabla: string) => sentencias.filter((s) => new RegExp(`public\\.${tabla}\\b`).test(s));

  it.each(TABLAS)('habilita RLS en %s', (tabla) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${tabla} enable row level security`, 'i'));
  });

  it('recursos_operativos: sin grants ni políticas para anon/public, solo operadores', () => {
    const s = sobre('recursos_operativos');
    expect(s.filter(concedeAAnon)).toEqual([]);
    expect(s.some((x) => /^revoke all on .*public\.recursos_operativos.* from anon/i.test(x))).toBe(true);
    const politicas = s.filter((x) => /^create policy/i.test(x));
    expect(politicas).toHaveLength(1);
    expect(politicas[0]).toMatch(/to authenticated/i);
    expect(politicas[0]).not.toMatch(/\banon\b|\bpublic\b(?!\.)/i);
    expect(politicas[0]).toMatch(/es_operador\(\)/);
  });

  it('incidentes (con timeline): sin acceso para anon', () => {
    const s = sobre('incidentes').filter((x) => !/zonas_riesgo/.test(x) || /^create policy/i.test(x));
    expect(s.filter(concedeAAnon)).toEqual([]);
    const politicas = s.filter((x) => /^create policy .* on public\.incidentes /i.test(x));
    expect(politicas.length).toBeGreaterThan(0);
    for (const p of politicas) expect(p).not.toMatch(/\banon\b/i);
  });

  it('el espejo público zonas_riesgo no incluye timeline', () => {
    const def = sql.match(/create table (?:if not exists )?public\.zonas_riesgo \(([\s\S]*?)\n\);/i)?.[1] ?? '';
    expect(def).not.toBe('');
    expect(def).not.toMatch(/timeline/i);
  });

  it('el público solo puede leer zonas y solo insertar reportes "No confirmado"', () => {
    const grants = sentencias.filter(concedeAAnon);
    expect(grants.sort()).toEqual(
      [
        'grant insert on public.reportes_ciudadanos to anon',
        'grant select on public.zonas_publicas to anon',
        'grant select on public.zonas_riesgo to anon',
      ].sort(),
    );
    const insertPublico = sentencias.find((s) => s.startsWith('create policy reportes_insert_publico'));
    expect(insertPublico).toMatch(/for insert/i);
    expect(insertPublico).toMatch(/estado_validacion = 'No confirmado'/);
  });

  it('las fotos: el público solo puede subir (sin listar) y con límites de tipo y tamaño', () => {
    const politicas = sentencias.filter((s) => /^create policy .* on storage\.objects/i.test(s));
    expect(politicas.length).toBeGreaterThan(0);
    for (const p of politicas) expect(p).toMatch(/for insert/i);
    expect(sql).toMatch(/file_size_limit/);
    expect(sql).toMatch(/allowed_mime_types/);
  });

  it('el rol operador se deriva de app_metadata (no editable por el usuario)', () => {
    expect(sql).toMatch(/app_metadata/);
    expect(sql).not.toMatch(/user_metadata/);
    expect(sql).not.toMatch(/security definer[^;]*\bes_operador|es_operador\(\)[^;]*security definer/i);
  });
});
