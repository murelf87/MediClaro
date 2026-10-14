// Proveedor CIMA (AEMPS, España). API REST pública: https://cima.aemps.es/cima/publico/api.html
import type { LeafletSection, MedicationDataProvider, MedicationSummary, Source } from './types.ts';
import { ProviderUnavailableError } from './types.ts';
import { cached } from '../cache.ts';

const BASE = 'https://cima.aemps.es/cima/rest';
const TTL_H = 24 * 7; // la ficha cambia poco: 7 días

async function get(path: string): Promise<any> {
  let r: Response;
  try {
    r = await fetch(`${BASE}${path}`, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) });
  } catch { throw new ProviderUnavailableError('CIMA'); }
  if (r.status >= 500) throw new ProviderUnavailableError('CIMA');
  if (!r.ok) return null;
  const t = await r.text();
  if (!t) return null;
  try { return JSON.parse(t); } catch { return t; }
}

const src = (url: string | null, section?: string): Source =>
  ({ provider: 'cima', label: 'CIMA · Agencia Española de Medicamentos (AEMPS)', url, section, fetchedAt: new Date().toISOString() });

/** EAN-13 español: 847000 + CN(6) + control. DataMatrix GS1: (01)0847000CNNNNNC… */
export function cnFromBarcode(code?: string | null): string | null {
  if (!code) return null;
  const d = code.replace(/[^0-9]/g, '');
  const m = d.match(/847000(\d{6})\d/);
  if (m) return m[1];
  return /^\d{6}$/.test(d) ? d : null;
}

function map(m: any): MedicationSummary | null {
  if (!m?.nregistro) return null;
  const foto = (m.fotos ?? []).find((f: any) => f.tipo === 'materialas') ?? (m.fotos ?? [])[0];
  return {
    id: String(m.nregistro),
    nombre: m.nombre,
    laboratorio: m.labtitular ?? null,
    principiosActivos: (m.principiosActivos ?? []).map((p: any) => ({ nombre: p.nombre, cantidad: p.cantidad ?? null, unidad: p.unidad ?? null }))
      .concat(!(m.principiosActivos ?? []).length && m.vtm?.nombre ? [{ nombre: m.vtm.nombre, cantidad: null, unidad: null }] : []),
    formaFarmaceutica: m.formaFarmaceuticaSimplificada?.nombre ?? m.formaFarmaceutica?.nombre ?? null,
    presentaciones: (m.presentaciones ?? []).map((p: any) => ({ cn: p.cn, nombre: p.nombre })),
    receta: !!m.receta,
    comercializado: m.comerc !== false,
    fotoUrl: foto?.url ?? null,
    source: src(`https://cima.aemps.es/cima/publico/detalle.html?nregistro=${m.nregistro}`),
  };
}

const SECTIONS: { n: number; key: LeafletSection['key']; title: string }[] = [
  { n: 1, key: 'indicaciones', title: 'Qué es y para qué se utiliza' },
  { n: 2, key: 'antes', title: 'Antes de tomarlo' },
  { n: 3, key: 'posologia', title: 'Cómo tomarlo' },
  { n: 4, key: 'efectos', title: 'Posibles efectos adversos' },
  { n: 5, key: 'conservacion', title: 'Conservación' },
];

const clean = (html: string) => String(html)
  .replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
  .replace(/&[a-z]+;/gi, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();

export const cimaProvider: MedicationDataProvider = {
  id: 'cima',
  country: 'ES',

  async searchMedication(query, limit = 8) {
    const q = query.trim().slice(0, 80);
    if (q.length < 3) return [];
    const d = await cached('cima', `search:${q.toLowerCase()}`, TTL_H, () => get(`/medicamentos?nombre=${encodeURIComponent(q)}&comerc=1`));
    return ((d?.resultados ?? []) as any[]).slice(0, limit).map(map).filter(Boolean) as MedicationSummary[];
  },

  async findByBarcode(code) {
    const cn = cnFromBarcode(code);
    return cn ? this.findByNationalCode(cn) : null;
  },

  async findByNationalCode(cn) {
    if (!/^\d{6}$/.test(cn)) return null;
    return map(await cached('cima', `cn:${cn}`, TTL_H, () => get(`/medicamento?cn=${cn}`)));
  },

  async getMedication(id) {
    if (!/^[\w-]{1,20}$/.test(id)) return null;
    return map(await cached('cima', `reg:${id}`, TTL_H, () => get(`/medicamento?nregistro=${id}`)));
  },

  async getLeaflet(id) {
    if (!/^[\w-]{1,20}$/.test(id)) return [];
    const url = await this.getLeafletUrl(id);
    const out = await Promise.all(SECTIONS.map(async s => {
      const d = await cached('cima', `pros:${id}:${s.n}`, TTL_H, () => get(`/docSegmentado/contenido/2?nregistro=${id}&seccion=${s.n}`));
      const text = clean(typeof d === 'string' ? d : (d?.contenido ?? '')).slice(0, 8000);
      return text ? { key: s.key, title: s.title, text, source: src(url, s.title) } : null;
    }));
    return out.filter(Boolean) as LeafletSection[];
  },

  async getLeafletUrl(id) {
    const m = await cached('cima', `reg:${id}`, TTL_H, () => get(`/medicamento?nregistro=${id}`));
    const doc = (m?.docs ?? []).find((d: any) => d.tipo === 2);
    return doc?.urlHtml ?? doc?.url ?? null;
  },

  async getTechnicalSheetUrl(id) {
    const m = await cached('cima', `reg:${id}`, TTL_H, () => get(`/medicamento?nregistro=${id}`));
    const doc = (m?.docs ?? []).find((d: any) => d.tipo === 1);
    return doc?.urlHtml ?? doc?.url ?? null;
  },
};

/** Registro de proveedores por país. Añadir aquí nuevos (p. ej. 'PT' → INFARMED). */
export function providerFor(country = 'ES'): MedicationDataProvider {
  switch (country) {
    case 'ES':
    default: return cimaProvider;
  }
}
