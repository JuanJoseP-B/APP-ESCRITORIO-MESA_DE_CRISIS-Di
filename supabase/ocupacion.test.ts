import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** Validación estática de la migración del ajuste atómico de aforo (no hay Postgres en CI). */
const sql = readFileSync(new URL('./migrations/0004_ajustar_ocupacion_zona.sql', import.meta.url), 'utf-8')
  .replace(/--.*$/gm, '')
  .replace(/\s+/g, ' ');

describe('migración ajustar_ocupacion_zona', () => {
  it('actualiza de forma relativa y acotada en una sola sentencia', () => {
    expect(sql).toMatch(/update public\.zonas_publicas set capacidad_actual = least\(capacidad_maxima, greatest\(0, capacidad_actual \+ p_delta\)\) where id = p_id returning \*/i);
  });

  it('respeta RLS y no es ejecutable por el público', () => {
    expect(sql).toMatch(/security invoker/i);
    expect(sql).not.toMatch(/security definer/i);
    expect(sql).toMatch(/revoke all on function public\.ajustar_ocupacion_zona\(uuid, integer\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.ajustar_ocupacion_zona\(uuid, integer\) to authenticated/i);
    expect(sql).not.toMatch(/grant [^;]* to [^;]*\banon\b/i);
  });
});
