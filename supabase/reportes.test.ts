import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TIPOS_EMERGENCIA } from '@argos/shared';

/** Validación estática de la migración 0003 (no hay Postgres en CI). */
const sql = readFileSync(new URL('./migrations/0003_tipos_emergencia_y_bandeja.sql', import.meta.url), 'utf-8')
  .replace(/--.*$/gm, '');

describe('migración 0003: reportes ciudadanos', () => {
  it('la restricción de tipo coincide con TIPOS_EMERGENCIA de @argos/shared', () => {
    const lista = sql.match(/constraint reportes_tipo_valido\s+check \(tipo in \(([^)]*)\)\)/i)?.[1] ?? '';
    expect(lista.split(',').map((t) => t.trim().replace(/'/g, ''))).toEqual([...TIPOS_EMERGENCIA]);
  });

  it('registra la fecha de recepción del reporte', () => {
    expect(sql).toMatch(/add column if not exists creado_en timestamptz not null default now\(\)/i);
  });

  it('reportes_ciudadanos queda publicada en Realtime y no se amplían privilegios', () => {
    expect(sql).toMatch(/alter publication supabase_realtime add table public\.reportes_ciudadanos/i);
    expect(sql).not.toMatch(/\bgrant\b|create policy|disable row level security/i);
  });
});

/** Validación estática de la migración 0005: reportes_ciudadanos pasa a llamadas. */
describe('migración 0005: llamadas', () => {
  const sql0005 = readFileSync(new URL('./migrations/0005_pivote_escritorio.sql', import.meta.url), 'utf-8').replace(
    /--.*$/gm,
    '',
  );

  it('renombra reportes_ciudadanos a llamadas solo si la tabla nueva no existe (idempotente)', () => {
    expect(sql0005).toMatch(/to_regclass\('public\.llamadas'\) is null/i);
    expect(sql0005).toMatch(/alter table public\.reportes_ciudadanos rename to llamadas/i);
  });

  it.each([
    ['canal', /add column if not exists canal text not null default '123'\s+check \(canal in \('123', 'VHF', 'SENSOR', 'PRESENCIAL'\)\)/i],
    ['prioridad', /add column if not exists prioridad text not null default 'P3'\s+check \(prioridad in \('P1', 'P2', 'P3', 'P4'\)\)/i],
    ['narrativa', /add column if not exists narrativa text not null default ''/i],
    ['callback', /add column if not exists callback text;/i],
    ['incidente_id', /add column if not exists incidente_id uuid references public\.incidentes \(id\) on delete set null/i],
    ['operador_id', /add column if not exists operador_id uuid references auth\.users \(id\) on delete set null/i],
  ])('añade la columna %s de forma idempotente', (_columna, patron) => {
    expect(sql0005).toMatch(patron);
  });

  it('no borra datos ni columnas', () => {
    expect(sql0005).not.toMatch(/\bdrop (table|column)\b|\btruncate\b|\bdelete from\b/i);
  });
});
