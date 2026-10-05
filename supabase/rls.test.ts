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
