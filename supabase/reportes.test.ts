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
