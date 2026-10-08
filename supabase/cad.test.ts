import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ORIGENES_PERIMETRO, PRIORIDAD_POR_CRITICIDAD, PRIORIDADES, TIPOS_EMERGENCIA } from '@argos/shared';

/** Validación estática de la 0006 (coordenadas, hora del servidor, timeline, incidentes). Sin Postgres en CI. */
const leer = (archivo: string): string =>
  readFileSync(new URL(`./migrations/${archivo}`, import.meta.url), 'utf-8').replace(/--.*$/gm, '').replace(/\s+/g, ' ');

const sql = leer('0006_cad_eventos_y_perimetro.sql');
const lista = (texto: string | undefined): string[] => (texto ?? '').split(',').map((t) => t.trim().replace(/'/g, ''));
const cuerpoDe = (funcion: string): string =>
  sql.match(new RegExp(`create or replace function public\\.${funcion}\\(.*?\\$\\$(.*?)\\$\\$`, 'i'))?.[1] ?? '';

describe('0006: ubicación y base de recursos', () => {
  it('son jsonb nullable validados por coordenada_valida()', () => {
    expect(sql).toMatch(/alter table public\.recursos_operativos add column if not exists ubicacion jsonb;/i);
    expect(sql).toMatch(/alter table public\.recursos_operativos add column if not exists base jsonb;/i);
    expect(sql).toMatch(/constraint recursos_ubicacion_valida check \(public\.coordenada_valida\(ubicacion\)\)/i);
    expect(sql).toMatch(/constraint recursos_base_valida check \(public\.coordenada_valida\(base\)\)/i);
  });

  it('coordenada_valida acota lat a ±90 y lng a ±180 y exige números', () => {
    const cuerpo = cuerpoDe('coordenada_valida');
    expect(cuerpo).toMatch(/between -90 and 90/);
    expect(cuerpo).toMatch(/between -180 and 180/);
    expect(cuerpo).toMatch(/jsonb_typeof\(p -> 'lat'\) is distinct from 'number'/);
  });

  it('no abre acceso anon a recursos_operativos', () => {
    expect(sql).not.toMatch(/on public\.recursos_operativos to [^;]*\banon\b/i);
    expect(leer('0001_esquema_y_rls.sql')).toMatch(/revoke all on public\.recursos_operativos from anon/i);
  });
});

describe('0006: hora_servidor', () => {
  const firma = sql.match(/create or replace function public\.hora_servidor\(\).*?\$\$/i)?.[0] ?? '';

  it('devuelve la hora real del servidor y respeta RLS (security invoker)', () => {
    expect(firma).toMatch(/returns timestamptz/i);
    expect(firma).toMatch(/security invoker/i);
    expect(firma).toMatch(/volatile/i);
    expect(cuerpoDe('hora_servidor')).toMatch(/clock_timestamp\(\)/i);
  });

  it('solo la ejecuta authenticated', () => {
    expect(sql).toMatch(/revoke all on function public\.hora_servidor\(\) from public, anon/i);
    expect(sql).toMatch(/grant execute on function public\.hora_servidor\(\) to authenticated/i);
  });
});

describe('0006: sellado del timeline con la hora del servidor', () => {
  const cuerpo = cuerpoDe('sellar_timeline');

  it('se dispara antes de insertar o de actualizar la columna timeline', () => {
    expect(sql).toMatch(
      /create trigger incidentes_sella_timeline before insert or update of timeline on public\.incidentes for each row execute function public\.sellar_timeline\(\)/i,
    );
  });

  it('sella solo los eventos que llegan sin creado_en', () => {
    expect(cuerpo).toMatch(
      /case when jsonb_typeof\(e\.evento\) = 'object' and not \(e\.evento \? 'creado_en'\) then e\.evento \|\| jsonb_build_object\('creado_en', public\.iso_utc\(now\(\)\)\) else e\.evento end/i,
    );
  });

  it('nunca reescribe un evento existente: los que ya traen creado_en pasan intactos', () => {
    // La rama `else e.evento` los devuelve tal cual; no hay funciones que modifiquen o quiten claves.
    expect(cuerpo).toMatch(/else e\.evento end/i);
    expect(cuerpo).not.toMatch(/jsonb_set|jsonb_insert|\bjsonb_strip_nulls|(?<![|])\s-\s'|#-/i);
    // Ni consulta el timeline anterior para pisar valores.
    expect(cuerpo).not.toMatch(/old\.timeline/i);
  });

  it('conserva el orden de los eventos', () => {
    expect(cuerpo).toMatch(/jsonb_agg\(.*order by e\.n\)/i);
    expect(cuerpo).toMatch(/with ordinality as e\(evento, n\)/i);
  });

  it('el relleno de eventos anteriores solo toca los que no tienen creado_en', () => {
    const relleno = sql.match(/update public\.incidentes i set timeline = \(.*?\); -- /i)?.[0] ?? sql.match(/update public\.incidentes i set timeline = \(.*?where jsonb_typeof\(i\.timeline\) = 'array' and exists \(.*?\)\);/i)?.[0] ?? '';
    expect(relleno).not.toBe('');
    expect(relleno).toMatch(/not \(x \? 'creado_en'\)/i);
    expect(relleno).toMatch(/else e\.evento end/i);
  });

  it('el relleno ocurre antes de crear el trigger, para que este no date los eventos viejos con hoy', () => {
    expect(sql.indexOf('update public.incidentes i set timeline')).toBeGreaterThan(-1);
    expect(sql.indexOf('update public.incidentes i set timeline')).toBeLessThan(sql.indexOf('create trigger incidentes_sella_timeline'));
  });
});

describe('0006: incidentes', () => {
  it('creado_en usa la hora del servidor', () => {
    expect(sql).toMatch(/alter table public\.incidentes add column if not exists creado_en timestamptz not null default now\(\)/i);
  });

  it('la prioridad hereda la equivalencia de criticidad de @argos/shared y se limita a P1–P4', () => {
    const casos = [...sql.matchAll(/when '([^']+)' then '(P\d)'/gi)];
    const tabla = Object.fromEntries(casos.map((m) => [m[1], m[2]]));
    expect(tabla).toEqual({ Crítico: PRIORIDAD_POR_CRITICIDAD.Crítico, Medio: PRIORIDAD_POR_CRITICIDAD.Medio });
    expect(sql).toMatch(/else 'P3' end/i);
    expect(PRIORIDAD_POR_CRITICIDAD.Bajo).toBe('P3');
    expect(lista(sql.match(/check \(prioridad in \(([^)]*)\)\)/i)?.[1])).toEqual([...PRIORIDADES]);
  });

  it('el tipo es nullable y acepta el catálogo TIPOS_EMERGENCIA', () => {
    expect(sql).toMatch(/alter table public\.incidentes add column if not exists tipo text;/i);
    expect(sql).not.toMatch(/column tipo text not null/i);
    expect(lista(sql.match(/check \(tipo is null or tipo in \(([^)]*)\)\)/i)?.[1])).toEqual([...TIPOS_EMERGENCIA]);
  });

  it('el tipo se rellena desde la llamada más antigua del incidente', () => {
    expect(sql).toMatch(/from public\.llamadas where incidente_id is not null order by incidente_id, creado_en asc/i);
  });

  it('perimetro_origen acepta los mismos orígenes que @argos/shared', () => {
    expect(lista(sql.match(/check \(perimetro_origen is null or perimetro_origen in \(([^)]*)\)\)/i)?.[1])).toEqual([...ORIGENES_PERIMETRO]);
  });
});

/** El anillo exterior (un Polygon) se guarda en `incidentes.geometria` y el trigger lo copia a `zonas_riesgo`. */
describe('geometría Polygon en incidentes y zonas_riesgo', () => {
  const base = leer('0001_esquema_y_rls.sql');
  const todas = [
    base,
    leer('0002_alinear_esquema_y_rls.sql'),
    leer('0003_tipos_emergencia_y_bandeja.sql'),
    leer('0004_ajustar_ocupacion_zona.sql'),
    leer('0005_pivote_escritorio.sql'),
    sql,
  ];

  it('incidentes.geometria y zonas_riesgo.geometria son jsonb sin restricción de tipo', () => {
    expect(base).toMatch(/create table public\.incidentes \([^;]*geometria jsonb not null/i);
    expect(base).toMatch(/create table public\.zonas_riesgo \([^;]*geometria jsonb not null/i);
    for (const migracion of todas) expect(migracion).not.toMatch(/check \([^)]*geometria/i);
  });

  it('el trigger copia la geometría completa, sea Point o Polygon', () => {
    const trigger = leer('0002_alinear_esquema_y_rls.sql').match(/create or replace function public\.sincronizar_zona_riesgo\(\).*?\$\$ (.*?) \$\$/i)?.[1] ?? '';
    expect(trigger).toMatch(/new\.geometria/);
    expect(trigger).toMatch(/geometria = excluded\.geometria/);
    expect(trigger).not.toMatch(/'Point'|ST_/i);
  });

  it('la 0006 no cambia el espejo ni el trigger de zonas_riesgo', () => {
    expect(sql).not.toMatch(/sincronizar_zona_riesgo|alter table public\.zonas_riesgo/i);
  });
});
