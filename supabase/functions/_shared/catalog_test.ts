function assertEquals(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
Deno.env.set('SUPABASE_URL', 'http://localhost');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
const { admin } = await import('./common.ts');
const { normalizeName, rowFromSummary, searchTokens, rankRows, asLocalCopy } = await import('./catalog.ts');
const { cimaProvider } = await import('./providers/cima.ts');

const med = (over: Record<string, unknown> = {}) => ({
  id: '65123',
  nombre: 'IBUPROFENO CINFA 600 mg COMPRIMIDOS RECUBIERTOS CON PELÍCULA EFG',
  laboratorio: 'CINFA',
  principiosActivos: [{ nombre: 'IBUPROFENO', cantidad: '600', unidad: 'mg' }],
  formaFarmaceutica: 'Comprimido recubierto',
  dosis: '600 mg',
  presentaciones: [{ cn: '654321', nombre: 'IBUPROFENO CINFA 600 mg 40 comprimidos' }, { cn: 'x', nombre: 'raro' }],
  receta: true,
  comercializado: true,
  fotoUrl: null,
  source: { provider: 'cima', label: 'CIMA', url: 'https://cima.aemps.es/', fetchedAt: '2026-10-01T00:00:00.000Z' },
  ...over,
});

Deno.test('normalizeName quita tildes, mayúsculas y signos', () => {
  assertEquals(normalizeName('  Paracetamol, 1 g — Cápsulas (EFG) '), 'paracetamol 1 g capsulas efg');
});

Deno.test('rowFromSummary guarda solo CN de 6 cifras y los textos para buscar', () => {
  const r = rowFromSummary(med() as any, '2026-10-14T10:00:00.000Z');
  assertEquals(r.nregistro, '65123');
  assertEquals(r.cns, ['654321']);
  assertEquals(r.nombre_norm.startsWith('ibuprofeno cinfa 600 mg'), true);
  assertEquals(r.principios_norm, 'ibuprofeno');
  assertEquals(r.comerc, true);
});

Deno.test('searchTokens: solo letras y números, sin palabras de una letra y con tope', () => {
  assertEquals(searchTokens("Ibuprofeno 'cinfa'; 600 mg, a"), ['ibuprofeno', 'cinfa', '600', 'mg']);
  assertEquals(searchTokens('a b c').length, 0);
  assertEquals(searchTokens('uno dos tres cuatro cinco seis siete ocho').length, 6);
});

Deno.test('rankRows pone primero el nombre que empieza como la búsqueda', () => {
  const tokens = ['ibuprofeno', '600'];
  const s = rankRows([{ nombre_norm: 'dalsy ibuprofeno 600' }, { nombre_norm: 'ibuprofeno cinfa 600 mg' }], tokens);
  assertEquals(s[1] > s[0], true);
});

Deno.test('asLocalCopy avisa en la fuente de que es la copia local y de su fecha', () => {
  const m = asLocalCopy({ data: med() as any, synced_at: '2026-10-14T10:00:00.000Z' });
  assertEquals(m.source.label.includes('copia local del 14/10/2026'), true);
  assertEquals(m.source.fetchedAt, '2026-10-14T10:00:00.000Z');
  assertEquals(m.nombre, med().nombre);
});

// ─── CIMA caída: se sirve la copia local, y si no hay copia se repite el error ──────────────────────────────

function fakeDb(catalogRows: unknown[]) {
  // Caché vacía; catálogo con las filas dadas. Cada consulta es encadenable y se resuelve al final.
  (admin as any).from = (table: string) => {
    const result = table === 'med_catalog'
      ? { data: catalogRows, error: null }
      : { data: null, error: null };
    const chain: any = {
      select: () => chain, eq: () => chain, or: () => chain, contains: () => chain, limit: () => chain,
      maybeSingle: () => Promise.resolve({ data: Array.isArray(result.data) ? (result.data[0] ?? null) : result.data, error: null }),
      upsert: () => Promise.resolve({ error: null }),
      then: (ok: (v: unknown) => unknown) => Promise.resolve(result).then(ok),
    };
    return chain;
  };
}
function ciMaDown() {
  (globalThis as any).fetch = () => Promise.reject(new Error('sin red'));
  // Evita esperar los reintentos reales: el temporizador se ejecuta al momento.
  (globalThis as any).setTimeout = (fn: () => void) => { fn(); return 0; };
}

Deno.test('CIMA caída + copia local: la búsqueda devuelve el medicamento con su fecha', async () => {
  ciMaDown();
  fakeDb([{ nombre_norm: 'ibuprofeno cinfa 600 mg', data: med(), synced_at: '2026-10-14T10:00:00.000Z' }]);
  const r = await cimaProvider.searchMedication('Ibuprofeno cinfa 600 mg');
  assertEquals(r.length, 1);
  assertEquals(r[0].source.label.includes('copia local'), true);
});

Deno.test('CIMA caída + código nacional en la copia local: se identifica', async () => {
  ciMaDown();
  fakeDb([{ data: med(), synced_at: '2026-10-14T10:00:00.000Z' }]);
  const r = await cimaProvider.findByNationalCode('654321');
  assertEquals(r?.id, '65123');
});

Deno.test('CIMA caída y la copia local no lo tiene: se repite el error, no un falso «no encontrado»', async () => {
  ciMaDown();
  fakeDb([]);
  let failed = false;
  try { await cimaProvider.searchMedication('Medicamento inexistente'); } catch { failed = true; }
  assertEquals(failed, true);
});
