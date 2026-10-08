import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Validación estática de la migración RLS (no hay Postgres en CI).
 * La verificación contra una base real está descrita en supabase/README.md.
 */
const sql = readFileSync(new URL('./migrations/0001_esquema_y_rls.sql', import.meta.url), 'utf-8');

const TABLAS = ['incidentes', 'reportes_ciudadanos', 'recursos_operativos', 'zonas_publicas', 'zonas_riesgo'];

/** Sentencias SQL sin comentarios de línea. */
const sentencias = sql
  .replace(/--.*$/gm, '')
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const sobre = (tabla: string) => sentencias.filter((s) => new RegExp(`public\\.${tabla}\\b`).test(s));
const concedeAAnon = (s: string) => /^grant .* to [^;]*\banon\b/i.test(s) || /^grant .* to [^;]*\bpublic\b/i.test(s);

describe('migración RLS', () => {
  it.each(TABLAS)('habilita RLS en %s', (tabla) => {
    expect(sql).toMatch(new RegExp(`alter table public\\.${tabla} enable row level security`, 'i'));
  });

  it('recursos_operativos: sin grants ni políticas para anon/public, solo operadores', () => {
    const s = sobre('recursos_operativos');
    expect(s.filter(concedeAAnon)).toEqual([]);
    expect(s.some((x) => /^revoke all on public\.recursos_operativos from anon/i.test(x))).toBe(true);
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
    for (const p of politicas) expect(p).not.toMatch(/\banon\b/i);
  });

  it('el espejo público zonas_riesgo no incluye timeline', () => {
    const def = sql.match(/create table public\.zonas_riesgo \(([\s\S]*?)\n\);/i)?.[1] ?? '';
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

  it('el rol operador se deriva de app_metadata (no editable por el usuario)', () => {
    expect(sql).toMatch(/app_metadata/);
    expect(sql).not.toMatch(/user_metadata/);
  });
});

/**
 * F1-T2: la migración 0005 retira el acceso del rol público (ya no hay portal ciudadano).
 * Se lee sin comentarios para que las explicaciones no cuenten como sentencias.
 */
describe('migración 0005: sin acceso anon', () => {
  const sql0005 = readFileSync(new URL('./migrations/0005_pivote_escritorio.sql', import.meta.url), 'utf-8').replace(
    /--.*$/gm,
    '',
  );
  const s0005 = sql0005
    .split(/;\s*(?:\n|$)/)
    .map((s) => s.replace(/\s+/g, ' ').trim())
    .filter(Boolean);
  const politicas = s0005.filter((s) => /\bcreate policy\b/i.test(s));

  it('crea políticas, y ninguna menciona el rol anon ni public', () => {
    expect(politicas.length).toBeGreaterThan(0);
    for (const p of politicas) expect(p).not.toMatch(/\banon\b|\bto public\b/i);
  });

  it('no concede privilegios a anon ni a public', () => {
    expect(s0005.filter(concedeAAnon)).toEqual([]);
  });

  it('llamadas exige es_operador() y solo para authenticated', () => {
    const p = politicas.filter((s) => /\bon public\.llamadas\b/i.test(s));
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/to authenticated/i);
    expect(p[0]).toMatch(/using \(public\.es_operador\(\)\) with check \(public\.es_operador\(\)\)/i);
  });

  it('cada política nueva (tablas y storage) exige es_operador()', () => {
    for (const p of politicas) expect(p).toMatch(/public\.es_operador\(\)/);
  });

  it('retira la lectura pública de zonas y la inserción anónima de reportes', () => {
    expect(sql0005).toMatch(/drop policy if exists zonas_publicas_lectura on public\.zonas_publicas/i);
    expect(sql0005).toMatch(/drop policy if exists zonas_riesgo_lectura on public\.zonas_riesgo/i);
    expect(sql0005).toMatch(/revoke all on public\.llamadas, public\.zonas_publicas, public\.zonas_riesgo from anon/i);
    // Las políticas viejas (`reportes_insert_publico`, `reportes_operador`) caen con el bucle sobre pg_policies.
    expect(sql0005).toMatch(/tablename = 'llamadas'/);
    expect(sql0005).toMatch(/execute format\('drop policy %I on %I\.%I'/i);
  });

  it('el bucket reportes pasa a privado y sin política de subida', () => {
    expect(sql0005).toMatch(/update storage\.buckets set public = false where id = 'reportes'/i);
    expect(sql0005).toMatch(/drop policy if exists reportes_fotos_subida on storage\.objects/i);
    expect(politicas.filter((s) => /\bfor insert\b/i.test(s))).toEqual([]);
  });

  it('habilita RLS en llamadas y mantiene Realtime sobre la tabla renombrada', () => {
    expect(sql0005).toMatch(/alter table public\.llamadas enable row level security/i);
    expect(sql0005).toMatch(/alter publication supabase_realtime add table public\.llamadas/i);
  });
});
