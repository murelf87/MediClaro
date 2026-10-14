// Proveedor oficial para EE. UU. preparado para la expansión internacional.
// Identificación/catálogo: FDA NDC Directory (openFDA). Etiquetado: FDA drug label/openFDA.
import type { LeafletSection, MedicationDataProvider, MedicationSummary, Source } from './types.ts';
import { ProviderUnavailableError } from './types.ts';
import { cached } from '../cache.ts';

const NDC = 'https://api.fda.gov/drug/ndc.json';
const LABEL = 'https://api.fda.gov/drug/label.json';
const TTL_H = 24 * 3;

async function getJson(url: string): Promise<any> {
  let r: Response;
  try { r = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }); }
  catch { throw new ProviderUnavailableError('FDA/openFDA'); }
  if (r.status === 404) return null;
  if (r.status >= 500) throw new ProviderUnavailableError('FDA/openFDA');
  if (!r.ok) return null;
  return await r.json().catch(() => null);
}

const safeTerm = (s: string) => s.replace(/[^A-Za-z0-9 ._\/-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 80);
const source = (setId: string, section?: string): Source => ({
  provider: 'openfda',
  label: 'FDA · NDC Directory / official drug labeling',
  url: setId ? `https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid=${encodeURIComponent(setId)}` : 'https://open.fda.gov/apis/drug/ndc/',
  section,
  fetchedAt: new Date().toISOString(),
});

function mapNdc(r: any): MedicationSummary | null {
  const setId = r?.openfda?.spl_set_id?.[0] ?? r?.spl_set_id;
  if (!setId) return null;
  const ingredients = Array.isArray(r.active_ingredients) ? r.active_ingredients : [];
  const packages = Array.isArray(r.packaging) ? r.packaging : [];
  return {
    id: String(setId),
    nombre: String(r.brand_name ?? r.generic_name ?? 'Drug'),
    laboratorio: r.labeler_name ? String(r.labeler_name) : null,
    principiosActivos: ingredients.map((x: any) => ({ nombre: String(x?.name ?? ''), cantidad: x?.strength ? String(x.strength) : null, unidad: null })).filter((x: any) => x.nombre),
    formaFarmaceutica: r.dosage_form ? String(r.dosage_form) : null,
    dosis: ingredients.map((x: any) => x?.strength).filter(Boolean).join(' / ') || null,
    presentaciones: packages.map((p: any) => ({ cn: String(p?.package_ndc ?? ''), nombre: String(p?.description ?? p?.package_ndc ?? '') })).filter((p: any) => p.cn),
    receta: /PRESCRIPTION/i.test(String(r.product_type ?? '')),
    comercializado: !r.marketing_end_date || String(r.marketing_end_date) >= new Date().toISOString().slice(0, 10).replace(/-/g, ''),
    fotoUrl: null,
    source: source(String(setId)),
  };
}

async function ndcSearch(field: string, value: string, limit: number): Promise<MedicationSummary[]> {
  const q = safeTerm(value);
  if (!q) return [];
  const url = `${NDC}?search=${encodeURIComponent(`${field}:\"${q}\"`)}&limit=${Math.min(limit, 20)}`;
  const d = await getJson(url);
  return ((d?.results ?? []) as any[]).map(mapNdc).filter(Boolean) as MedicationSummary[];
}

function cleanText(v: unknown): string {
  const a = Array.isArray(v) ? v : v ? [v] : [];
  return a.map(String).join('\n').replace(/\s+/g, ' ').trim().slice(0, 12000);
}

export const usProvider: MedicationDataProvider = {
  id: 'openfda',
  country: 'US',

  async searchMedication(query, limit = 8) {
    const [brand, generic] = await Promise.all([
      ndcSearch('brand_name', query, limit).catch(() => []),
      ndcSearch('generic_name', query, limit).catch(() => []),
    ]);
    const byId = new Map<string, MedicationSummary>();
    [...brand, ...generic].forEach(m => byId.set(m.id, m));
    return [...byId.values()].slice(0, limit);
  },

  async findByBarcode(code) {
    const digits = code.replace(/\D/g, '');
    if (!digits) return null;
    const d = await cached('openfda', `upc:${digits}`, TTL_H, () => getJson(`${NDC}?search=${encodeURIComponent(`openfda.upc:\"${digits}\"`)}&limit=1`));
    return mapNdc(d?.results?.[0]);
  },

  async findByNationalCode(code) {
    const q = safeTerm(code);
    if (!q) return null;
    const d = await cached('openfda', `ndc:${q}`, TTL_H, () => getJson(`${NDC}?search=${encodeURIComponent(`packaging.package_ndc:\"${q}\"`)}&limit=1`));
    return mapNdc(d?.results?.[0]);
  },

  async getMedication(id) {
    if (!/^[A-Fa-f0-9-]{36}$/.test(id)) return null;
    const d = await cached('openfda', `set:${id}`, TTL_H, () => getJson(`${NDC}?search=${encodeURIComponent(`openfda.spl_set_id:\"${id}\"`)}&limit=1`));
    return mapNdc(d?.results?.[0]);
  },

  async getLeaflet(id) {
    if (!/^[A-Fa-f0-9-]{36}$/.test(id)) return [];
    const d = await cached('openfda-label', `set:${id}`, TTL_H, () => getJson(`${LABEL}?search=${encodeURIComponent(`openfda.spl_set_id:\"${id}\"`)}&limit=1`));
    const r = d?.results?.[0];
    if (!r) return [];
    const defs: { key: LeafletSection['key']; title: string; fields: string[] }[] = [
      { key: 'indicaciones', title: 'Indications and usage', fields: ['indications_and_usage'] },
      { key: 'antes', title: 'Warnings and precautions', fields: ['boxed_warning', 'warnings', 'warnings_and_cautions', 'contraindications'] },
      { key: 'posologia', title: 'Dosage and administration', fields: ['dosage_and_administration'] },
      { key: 'efectos', title: 'Adverse reactions', fields: ['adverse_reactions'] },
      { key: 'conservacion', title: 'Storage and handling', fields: ['storage_and_handling', 'how_supplied'] },
    ];
    return defs.map(dfn => {
      const text = cleanText(dfn.fields.flatMap(f => r[f] ?? []));
      return text ? { key: dfn.key, title: dfn.title, text, source: source(id, dfn.title) } : null;
    }).filter(Boolean) as LeafletSection[];
  },

  async getTechnicalSheetUrl(id) { return /^[A-Fa-f0-9-]{36}$/.test(id) ? source(id).url : null; },
  async getLeafletUrl(id) { return /^[A-Fa-f0-9-]{36}$/.test(id) ? source(id).url : null; },
};
