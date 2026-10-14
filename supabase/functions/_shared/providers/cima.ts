// Proveedor CIMA (AEMPS, España). API REST pública oficial.
import type { LeafletSection, MedicationDataProvider, MedicationSummary, Source } from './types.ts';
import { ProviderUnavailableError } from './types.ts';
import { cached } from '../cache.ts';
import { catalogByCN, catalogById, searchCatalog } from '../catalog.ts';

const BASE = 'https://cima.aemps.es/cima/rest';
const TTL_H = 24 * 7; // la ficha cambia poco: 7 días; la fecha real de obtención se conserva en Source

/**
 * Si CIMA no responde, se usa la copia local del catálogo (med_catalog), que es de la misma fuente oficial
 * y deja su fecha en la fuente. Si la copia no tiene nada, se repite el error original: nunca se convierte una
 * caída en un falso «no encontrado».
 */
async function orLocalCopy<T>(e: unknown, local: () => Promise<T>, isEmpty: (r: T) => boolean): Promise<T> {
  if (!(e instanceof ProviderUnavailableError)) throw e;
  let r: T;
  try { r = await local(); } catch { throw e; }
  if (isEmpty(r)) throw e;
  console.error('CIMA caída: se sirve la copia local del catálogo');
  return r;
}

export async function get(path: string): Promise<any> {
  let lastStatus = 0;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const r = await fetch(`${BASE}${path}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      lastStatus = r.status;
      if (r.ok) {
        const t = await r.text();
        if (!t) return null;
        try { return JSON.parse(t); } catch { return t; }
      }
      if (r.status < 500 && r.status !== 429) return null;
    } catch {
      // Error de red/timeout: reintentamos antes de declarar CIMA no disponible.
    }
    if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 350 * (attempt + 1)));
  }
  console.error('CIMA unavailable', { path, lastStatus });
  throw new ProviderUnavailableError('CIMA');
}

const src = (url: string | null, section?: string): Source =>
  ({ provider: 'cima', label: 'CIMA · Agencia Española de Medicamentos (AEMPS)', url, section, fetchedAt: new Date().toISOString() });

/** EAN-13 español: 847000 + CN(6) + control. DataMatrix GS1 puede incluir GTIN 0847000+CN+control. */
export function cnFromBarcode(code?: string | null): string | null {
  if (!code) return null;
  const d = code.replace(/[^0-9]/g, '');
  const m = d.match(/847000(\d{6})\d/);
  if (m) return m[1];
  return /^\d{6}$/.test(d) ? d : null;
}

function activeIngredients(m: any): MedicationSummary['principiosActivos'] {
  if (Array.isArray(m?.principiosActivos) && m.principiosActivos.length) {
    return m.principiosActivos
      .filter((p: any) => p?.nombre)
      .map((p: any) => ({ nombre: String(p.nombre), cantidad: p.cantidad == null ? null : String(p.cantidad), unidad: p.unidad == null ? null : String(p.unidad) }));
  }
  if (typeof m?.pactivos === 'string' && m.pactivos.trim()) {
    return m.pactivos.split(',').map((nombre: string) => ({ nombre: nombre.trim(), cantidad: null, unidad: null })).filter((p: any) => p.nombre);
  }
  if (m?.vtm?.nombre) return [{ nombre: String(m.vtm.nombre), cantidad: null, unidad: null }];
  return [];
}

export function map(m: any): MedicationSummary | null {
  if (!m?.nregistro || !m?.nombre) return null;
  const foto = (m.fotos ?? []).find((f: any) => f.tipo === 'materialas') ?? (m.fotos ?? [])[0];
  return {
    id: String(m.nregistro),
    nombre: String(m.nombre),
    laboratorio: m.labtitular ? String(m.labtitular) : null,
    principiosActivos: activeIngredients(m),
    formaFarmaceutica: m.formaFarmaceuticaSimplificada?.nombre ?? m.formaFarmaceutica?.nombre ?? null,
    dosis: m.dosis ? String(m.dosis) : null,
    presentaciones: (m.presentaciones ?? []).filter((p: any) => p?.cn).map((p: any) => ({ cn: String(p.cn), nombre: String(p.nombre ?? p.cn) })),
    receta: !!m.receta,
    comercializado: m.comerc !== false,
    fotoUrl: foto?.url ?? null,
    source: src(`https://cima.aemps.es/cima/publico/detalle.html?nregistro=${encodeURIComponent(String(m.nregistro))}`),
  };
}

const SECTIONS: { n: number; key: LeafletSection['key']; title: string }[] = [
  { n: 1, key: 'indicaciones', title: 'Qué es y para qué se utiliza' },
  { n: 2, key: 'antes', title: 'Antes de tomarlo' },
  { n: 3, key: 'posologia', title: 'Cómo tomarlo' },
  { n: 4, key: 'efectos', title: 'Posibles efectos adversos' },
  { n: 5, key: 'conservacion', title: 'Conservación' },
];

// Códigos HTML que trae CIMA en los prospectos (`&#233;`, `&#xa0;`, `&#8220;`, `&aacute;`…). Antes solo se
// convertían unos pocos y los numéricos llegaban tal cual a la pantalla («Qu&#233; es Vimpat»).
const NAMED_ENTITIES: Record<string, string> = {
  nbsp: ' ', amp: '&', quot: '"', apos: "'", lt: '<', gt: '>',
  ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', laquo: '«', raquo: '»', sbquo: '‚', bdquo: '„',
  ndash: '–', mdash: '—', hellip: '…', bull: '•', middot: '·', deg: 'º', ordm: 'º', ordf: 'ª',
  iexcl: '¡', iquest: '¿', micro: 'µ', plusmn: '±', times: '×', divide: '÷', frac12: '½', frac14: '¼',
  frac34: '¾', sup2: '²', sup3: '³', copy: '©', reg: '®', trade: '™', euro: '€', shy: '', le: '≤', ge: '≥',
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú', Aacute: 'Á', Eacute: 'É', Iacute: 'Í',
  Oacute: 'Ó', Uacute: 'Ú', ntilde: 'ñ', Ntilde: 'Ñ', uuml: 'ü', Uuml: 'Ü', ccedil: 'ç', Ccedil: 'Ç',
  agrave: 'à', egrave: 'è', ograve: 'ò', iuml: 'ï', ouml: 'ö', auml: 'ä', euml: 'ë',
};
const ENTITY = /&(#x[0-9a-f]+|#[0-9]+|[a-z][a-z0-9]*);/gi;

function codePoint(n: number): string {
  if (!Number.isFinite(n) || n <= 0 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) return '';
  return String.fromCodePoint(n);
}

export function decodeEntities(text: string): string {
  let out = text;
  // Hasta tres pasadas: CIMA a veces los trae dobles (`&amp;#233;`).
  for (let i = 0; i < 3; i++) {
    const next = out.replace(ENTITY, (whole, body: string) => {
      if (body[0] === '#') {
        const hex = body[1] === 'x' || body[1] === 'X';
        return codePoint(hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10));
      }
      return NAMED_ENTITIES[body] ?? NAMED_ENTITIES[body.toLowerCase()] ?? ' ';
    });
    if (next === out) break;
    out = next;
  }
  return out.replace(/\u00a0/g, ' ');
}

const clean = (html: string) => decodeEntities(
  String(html).replace(/<\/(p|li|h\d)>/gi, '\n').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' '),
).replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n\s*\n+/g, '\n').trim();

/** CIMA devuelve docSegmentado/contenido como array de secciones; algunas versiones devuelven objeto. */
function sectionText(raw: any): string {
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return rows
    .map((row: any) => clean(typeof row === 'string' ? row : String(row?.contenido ?? '')))
    .filter(Boolean)
    .join('\n')
    .slice(0, 12000);
}

export const cimaProvider: MedicationDataProvider = {
  id: 'cima',
  country: 'ES',

  async searchMedication(query, limit = 8) {
    const q = query.trim().slice(0, 80);
    if (q.length < 3) return [];
    try {
      const d = await cached('cima', `search:${q.toLowerCase()}`, TTL_H, () => get(`/medicamentos?nombre=${encodeURIComponent(q)}&comerc=1`));
      const raw = ((d?.resultados ?? []) as any[]).slice(0, Math.min(limit, 10));

      // El listado de CIMA no siempre incluye todos los campos usados para la confianza.
      // Enriquecemos cada candidato con /medicamento?nregistro=... antes de puntuarlo.
      const full = await Promise.all(raw.map(async (item: any) => {
        const id = String(item?.nregistro ?? '');
        if (!id) return map(item);
        const detailed = await cached('cima', `reg:${id}`, TTL_H, () => get(`/medicamento?nregistro=${encodeURIComponent(id)}`));
        return map(detailed ?? item);
      }));
      return full.filter(Boolean).slice(0, limit) as MedicationSummary[];
    } catch (e) {
      return orLocalCopy(e, () => searchCatalog(q, limit), r => r.length === 0);
    }
  },

  async findByBarcode(code) {
    const cn = cnFromBarcode(code);
    return cn ? this.findByNationalCode(cn) : null;
  },

  async findByNationalCode(cn) {
    if (!/^\d{6}$/.test(cn)) return null;
    try {
      return map(await cached('cima', `cn:${cn}`, TTL_H, () => get(`/medicamento?cn=${encodeURIComponent(cn)}`)));
    } catch (e) {
      return orLocalCopy(e, () => catalogByCN(cn), r => r === null);
    }
  },

  async getMedication(id) {
    if (!/^[\w-]{1,40}$/.test(id)) return null;
    try {
      return map(await cached('cima', `reg:${id}`, TTL_H, () => get(`/medicamento?nregistro=${encodeURIComponent(id)}`)));
    } catch (e) {
      return orLocalCopy(e, () => catalogById(id), r => r === null);
    }
  },

  async getLeaflet(id) {
    if (!/^[\w-]{1,40}$/.test(id)) return [];
    const url = await this.getLeafletUrl(id);
    const out = await Promise.all(SECTIONS.map(async s => {
      const d = await cached('cima', `pros:${id}:${s.n}`, TTL_H, () => get(`/docSegmentado/contenido/2?nregistro=${encodeURIComponent(id)}&seccion=${s.n}`));
      const text = sectionText(d);
      return text ? { key: s.key, title: s.title, text, source: src(url, s.title) } : null;
    }));
    return out.filter(Boolean) as LeafletSection[];
  },

  async getLeafletUrl(id) {
    const m = await cached('cima', `reg:${id}`, TTL_H, () => get(`/medicamento?nregistro=${encodeURIComponent(id)}`));
    const doc = (m?.docs ?? []).find((d: any) => d.tipo === 2);
    return doc?.urlHtml ?? doc?.url ?? null;
  },

  async getTechnicalSheetUrl(id) {
    const m = await cached('cima', `reg:${id}`, TTL_H, () => get(`/medicamento?nregistro=${encodeURIComponent(id)}`));
    const doc = (m?.docs ?? []).find((d: any) => d.tipo === 1);
    return doc?.urlHtml ?? doc?.url ?? null;
  },
};
