import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ESTADOS_RECURSO, TRANSICIONES_RECURSO, type EstadoRecurso } from '@argos/shared';

/**
 * F2-T6: validación estática de la migración 0006 (no hay Postgres en CI; la verificación contra una base
 * real está en supabase/README.md). Se lee sin comentarios para que las explicaciones no cuenten.
 */
const sql = readFileSync(new URL('./migrations/0006_cad_eventos_y_perimetro.sql', import.meta.url), 'utf-8').replace(
  /--.*$/gm,
  '',
);
const compacto = sql.replace(/\s+/g, ' ');

/** Sentencias de nivel superior; el cuerpo de una función ($$ ... $$) se conserva como un bloque. */
const sentencias = sql
  .replace(/\$\$[\s\S]*?\$\$/g, '$$body$$')
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.replace(/\s+/g, ' ').trim())
  .filter(Boolean);

const sobre = (tabla: string) => sentencias.filter((s) => new RegExp(`public\\.${tabla}\\b`).test(s));
const cuerpoDe = (funcion: string): string =>
  compacto.match(new RegExp(`create or replace function public\\.${funcion}\\(.*?\\$\\$(.*?)\\$\\$`, 'i'))?.[1] ?? '';

describe('0006: eventos_recurso es de solo inserción', () => {
  const s = sobre('eventos_recurso');
  const politicas = s.filter((x) => /^create policy/i.test(x));

  it('habilita RLS y define solo políticas de SELECT e INSERT', () => {
    expect(compacto).toMatch(/alter table public\.eventos_recurso enable row level security/i);
    expect(politicas).toHaveLength(2);
    expect(politicas.filter((p) => /\bfor select\b/i.test(p))).toHaveLength(1);
    expect(politicas.filter((p) => /\bfor insert\b/i.test(p))).toHaveLength(1);
  });

  it('no crea políticas UPDATE, DELETE ni ALL', () => {
    for (const p of politicas) expect(p).not.toMatch(/\bfor (update|delete|all)\b/i);
  });

  it('solo concede select e insert, y únicamente a authenticated', () => {
    const grants = s.filter((x) => /^grant /i.test(x));
    expect(grants).toEqual(['grant select, insert on public.eventos_recurso to authenticated']);
    expect(s.some((x) => /^revoke all on public\.eventos_recurso from anon, authenticated/i.test(x))).toBe(true);
  });

  it('cada política exige es_operador() y ninguna menciona anon ni public', () => {
    for (const p of politicas) {
      expect(p).toMatch(/public\.es_operador\(\)/);
      expect(p).toMatch(/to authenticated/i);
      expect(p).not.toMatch(/\banon\b|\bto public\b/i);
    }
  });

  it('la hora la fija el servidor y el origen está acotado', () => {
    expect(compacto).toMatch(/creado_en timestamptz not null default now\(\)/i);
    expect(compacto).toMatch(/origen text not null default 'MANUAL' check \(origen in \('MANUAL', 'IA', 'SISTEMA'\)\)/i);
  });

  it('queda publicada en Realtime', () => {
    expect(compacto).toMatch(/alter publication supabase_realtime add table public\.eventos_recurso/i);
  });
});

describe('0006: RPC transicionar_recurso', () => {
  it('es security invoker (RLS decide) y nunca security definer', () => {
    const firma = compacto.match(/create or replace function public\.transicionar_recurso\(.*?language plpgsql[^$]*\$\$/i)?.[0] ?? '';
    expect(firma).toMatch(/security invoker/i);
    expect(compacto).not.toMatch(/security definer/i);
  });

  it('solo la ejecuta authenticated', () => {
    expect(compacto).toMatch(/revoke all on function public\.transicionar_recurso\(uuid, text, uuid, text\) from public, anon/i);
    expect(compacto).toMatch(/grant execute on function public\.transicionar_recurso\(uuid, text, uuid, text\) to authenticated/i);
    expect(compacto).not.toMatch(/grant [^;]* to [^;]*\banon\b/i);
  });

  it('cambia el estado e inserta el evento en el mismo cuerpo (una transacción)', () => {
    const cuerpo = cuerpoDe('transicionar_recurso');
    expect(cuerpo).toMatch(/update public\.recursos_operativos set estado_actual = p_hacia/i);
    expect(cuerpo).toMatch(/insert into public\.eventos_recurso/i);
    expect(cuerpo.indexOf('update public.recursos_operativos')).toBeLessThan(cuerpo.indexOf('insert into public.eventos_recurso'));
  });

  it('valida la transición con la misma función que usa el trigger', () => {
    expect(cuerpoDe('transicionar_recurso')).toMatch(/public\.transicion_recurso_permitida\(/);
    expect(compacto).toMatch(/before update of estado_actual on public\.recursos_operativos/i);
    expect(cuerpoDe('validar_transicion_recurso')).toMatch(/public\.transicion_recurso_permitida\(old\.estado_actual, new\.estado_actual\)/);
  });

  it('la cancelación (ASIGNADO o EN_RUTA a DISPONIBLE) deja el incidente liberado en el evento', () => {
    expect(cuerpoDe('transicionar_recurso')).toMatch(/coalesce\(v_incidente, v_actual\.incidente_asignado_id\)/i);
  });
});

describe('0006: coherencia con @argos/shared', () => {
  it('el check de estados coincide con ESTADOS_RECURSO', () => {
    const lista = compacto.match(/constraint recursos_estado_valido check \(estado_actual in \(([^)]*)\)\)/i)?.[1] ?? '';
    expect(lista.split(',').map((t) => t.trim().replace(/'/g, ''))).toEqual([...ESTADOS_RECURSO]);
  });

  it('la tabla de transiciones del SQL es idéntica a TRANSICIONES_RECURSO', () => {
    const cuerpo = cuerpoDe('transicion_recurso_permitida');
    const sqlTabla = new Map<string, string[]>();
    for (const m of cuerpo.matchAll(/when '(\w+)' then p_hacia (?:in \(([^)]*)\)|= '(\w+)')/gi)) {
      const destinos = m[2] ? m[2].split(',').map((d) => d.trim().replace(/'/g, '')) : [m[3] ?? ''];
      sqlTabla.set(m[1] ?? '', destinos);
    }
    expect([...sqlTabla.keys()].sort()).toEqual([...ESTADOS_RECURSO].sort());
    for (const desde of ESTADOS_RECURSO) {
      expect([...(sqlTabla.get(desde) ?? [])].sort()).toEqual([...TRANSICIONES_RECURSO[desde as EstadoRecurso]].sort());
    }
  });

  it('el check de eventos_recurso acepta los mismos estados', () => {
    for (const columna of ['desde', 'hacia']) {
      const lista = compacto.match(new RegExp(`${columna} text not null check \\(${columna} in \\(([^)]*)\\)\\)`, 'i'))?.[1] ?? '';
      expect(lista.split(',').map((t) => t.trim().replace(/'/g, ''))).toEqual([...ESTADOS_RECURSO]);
    }
  });
});

describe('0006: sin acceso anon', () => {
  it('no concede privilegios a anon ni a public, ni crea políticas para ellos', () => {
    const concedeAAnon = (s: string) => /^grant .* to [^;]*\b(anon|public)\b/i.test(s);
    expect(sentencias.filter(concedeAAnon)).toEqual([]);
    for (const p of sentencias.filter((s) => /^create policy/i.test(s))) expect(p).not.toMatch(/\banon\b|\bto public\b/i);
  });

  it('no toca las políticas de recursos_operativos: sigue siendo solo de operadores', () => {
    expect(sobre('recursos_operativos').filter((s) => /\bpolicy\b/i.test(s))).toEqual([]);
  });

  it('no borra datos', () => {
    expect(compacto).not.toMatch(/\bdrop (table|column)\b|\btruncate\b|\bdelete from\b/i);
  });
});
