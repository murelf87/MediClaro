// Copia local del catálogo de CIMA (tabla med_catalog). Solo se usa cuando CIMA no responde:
// la información sigue siendo la oficial, con la fecha de la última sincronización a la vista.
// Nunca se rellena con lecturas de la IA.
import { admin } from './common.ts';
import type { MedicationSummary } from './providers/types.ts';

/** Sin tildes, minúsculas, solo letras y números separados por un espacio. */
export function normalizeName(s: string): string {
  return String(s ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export type CatalogRow = {
  nregistro: string;
  nombre_norm: string;
  principios_norm: string;
  cns: string[];
  comerc: boolean;
  data: MedicationSummary;
  synced_at: string;
};

/** Fila del catálogo a partir de un medicamento ya mapeado desde CIMA. */
export function rowFromSummary(m: MedicationSummary, syncedAt: string): CatalogRow {
  return {
    nregistro: m.id,
    nombre_norm: normalizeName(m.nombre),
    principios_norm: normalizeName((m.principiosActivos ?? []).map(p => p.nombre).join(' ')),
    cns: [...new Set((m.presentaciones ?? []).map(p => String(p.cn)).filter(cn => /^\d{6}$/.test(cn)))],
    comerc: m.comercializado,
    data: m,
    synced_at: syncedAt,
  };
}

/** Palabras de búsqueda: solo [a-z0-9], así pueden ir sin riesgo dentro de un filtro. */
export function searchTokens(query: string): string[] {
  return normalizeName(query).split(' ').filter(t => t.length >= 2).slice(0, 6);
}

/** Orden: más palabras en el nombre y nombre que empieza como la búsqueda. */
export function rankRows(rows: Pick<CatalogRow, 'nombre_norm'>[], tokens: string[]): number[] {
  const first = tokens[0] ?? '';
  return rows.map(r => tokens.reduce((n, t) => n + (r.nombre_norm.includes(t) ? 2 : 0), 0) + (first && r.nombre_norm.startsWith(first) ? 3 : 0));
}

function ddmmyyyy(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}/${d.getUTCFullYear()}`;
}

/** Misma ficha, pero la fuente avisa de que es la copia local y de su fecha. */
export function asLocalCopy(row: Pick<CatalogRow, 'data' | 'synced_at'>): MedicationSummary {
  return {
    ...row.data,
    source: {
      ...row.data.source,
      label: `CIMA · Agencia Española de Medicamentos (AEMPS) · copia local del ${ddmmyyyy(row.synced_at)}`,
      fetchedAt: row.synced_at,
    },
  };
}

export async function searchCatalog(query: string, limit = 8): Promise<MedicationSummary[]> {
  const tokens = searchTokens(query);
  if (!tokens.length) return [];
  const run = async (ts: string[]) => {
    let q = admin.from('med_catalog').select('nombre_norm, data, synced_at').eq('comerc', true);
    for (const t of ts) q = q.or(`nombre_norm.ilike.%${t}%,principios_norm.ilike.%${t}%`);
    const { data, error } = await q.limit(60);
    if (error) throw error;
    return (data ?? []) as Pick<CatalogRow, 'nombre_norm' | 'data' | 'synced_at'>[];
  };
  let rows = await run(tokens);
  // Si la lectura de la caja trae una palabra de más, se prueba con las dos primeras.
  if (!rows.length && tokens.length > 2) rows = await run(tokens.slice(0, 2));
  const scores = rankRows(rows, tokens);
  return rows
    .map((r, i) => ({ r, s: scores[i] }))
    .sort((a, b) => b.s - a.s)
    .slice(0, Math.min(limit, 10))
    .map(x => asLocalCopy(x.r));
}

export async function catalogByCN(cn: string): Promise<MedicationSummary | null> {
  if (!/^\d{6}$/.test(cn)) return null;
  const { data, error } = await admin.from('med_catalog').select('data, synced_at').contains('cns', [cn]).limit(1).maybeSingle();
  if (error) throw error;
  return data ? asLocalCopy(data as Pick<CatalogRow, 'data' | 'synced_at'>) : null;
}

export async function catalogById(id: string): Promise<MedicationSummary | null> {
  const { data, error } = await admin.from('med_catalog').select('data, synced_at').eq('nregistro', id).maybeSingle();
  if (error) throw error;
  return data ? asLocalCopy(data as Pick<CatalogRow, 'data' | 'synced_at'>) : null;
}
