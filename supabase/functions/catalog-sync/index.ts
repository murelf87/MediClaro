// Sincroniza la copia local del catálogo de CIMA (tabla med_catalog), para poder identificar medicamentos
// cuando CIMA no responde. Invocar desde Supabase Cron con X-Cron-Secret (p. ej. cada 10 minutos: avanza por
// tandas y se reanuda donde lo dejó; cuando termina una vuelta completa espera 6 días a empezar la siguiente).
// Solo copia datos públicos de medicamentos. Los prospectos no se copian.
import { admin, json } from '../_shared/common.ts';
import { rowFromSummary } from '../_shared/catalog.ts';
import { get, map } from '../_shared/providers/cima.ts';

const PAGES_PER_RUN = 25;           // tanda por invocación, para no pasar del tiempo máximo de la función
const REFRESH_AFTER_DAYS = 6;       // días entre vueltas completas
const DEADLINE_MS = 90_000;         // se corta la tanda antes del límite de la plataforma

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return json({ error: 'not configured' }, 503);
  if (req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);

  const t0 = Date.now();
  const { data: st, error: stErr } = await admin.from('med_catalog_sync').select('*').eq('id', 1).single();
  if (stErr) throw stErr;

  const now = new Date();
  const finishedMs = st.finished_at ? new Date(st.finished_at).getTime() : null;
  if (finishedMs && now.getTime() - finishedMs < REFRESH_AFTER_DAYS * 86_400_000) {
    return json({ ok: true, skipped: 'catálogo al día', finishedAt: st.finished_at });
  }

  // Vuelta nueva si no hay ninguna empezada o la anterior terminó.
  let page = st.next_page as number;
  let startedAt = st.started_at as string | null;
  if (!startedAt || st.finished_at) {
    page = 1;
    startedAt = now.toISOString();
    await admin.from('med_catalog_sync').update({
      next_page: 1, started_at: startedAt, finished_at: null, last_error: null, updated_at: now.toISOString(),
    }).eq('id', 1);
  }

  let saved = 0;
  let done = false;
  try {
    for (let i = 0; i < PAGES_PER_RUN && Date.now() - t0 < DEADLINE_MS; i++) {
      const d = await get(`/medicamentos?comerc=1&pagina=${page}`);
      const items = (d?.resultados ?? []) as any[];
      const size = Number(d?.tamanioPagina) || items.length;
      const total = Number(d?.totalFilas) || null;

      const rows = items
        .map((it) => map(it))
        .filter((m): m is NonNullable<typeof m> => !!m)
        .map((m) => rowFromSummary(m, new Date().toISOString()));
      if (rows.length) {
        const { error } = await admin.from('med_catalog').upsert(rows, { onConflict: 'nregistro' });
        if (error) throw error;
        saved += rows.length;
      }

      const last = !items.length || (total != null && size > 0 && page * size >= total);
      page += 1;
      await admin.from('med_catalog_sync').update({
        next_page: page, total_rows: total, last_error: null, updated_at: new Date().toISOString(),
      }).eq('id', 1);
      if (last) { done = true; break; }
    }

    if (done) {
      // Se retiran los que ya no están en CIMA (no tocados en esta vuelta). Solo si la vuelta terminó entera.
      const { error } = await admin.from('med_catalog').delete().lt('synced_at', startedAt);
      if (error) throw error;
      await admin.from('med_catalog_sync').update({ finished_at: new Date().toISOString() }).eq('id', 1);
    }
    return json({ ok: true, saved, nextPage: page, done });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await admin.from('med_catalog_sync').update({ last_error: message.slice(0, 300), updated_at: new Date().toISOString() }).eq('id', 1);
    console.error('catalog-sync', message);
    // 200 para que el cron lo reintente en su siguiente turno sin dar la pasada por perdida.
    return json({ ok: false, error: message, saved, nextPage: page });
  }
});
