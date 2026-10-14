// Limpieza de cuentas anónimas abandonadas. Invocar desde Supabase Cron con X-Cron-Secret.
import { admin, json } from '../_shared/common.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = Deno.env.get('CRON_SECRET');
  if (!secret) return json({ error: 'not configured' }, 503);
  if (req.headers.get('x-cron-secret') !== secret) return json({ error: 'unauthorized' }, 401);
  const cutoffMs = Date.now() - 24 * 60 * 60 * 1000;
  let page = 1;
  let deleted = 0;
  while (page <= 20) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const users = data?.users ?? [];
    for (const u of users) {
      if (!u.is_anonymous || new Date(u.created_at).getTime() >= cutoffMs) continue;
      const { data: profile, error: profileError } = await admin.from('profiles').select('plan, sub_state').eq('id', u.id).maybeSingle();
      if (profileError) throw profileError;
      if (profile?.plan === 'premium' || ['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(String(profile?.sub_state ?? ''))) continue;
      // Free caregivers/patients with a link are not abandoned checkout accounts.
      // Fail closed on lookup errors: never delete a potentially linked care account.
      const { data: careLinks, error: careError } = await admin.from('care_links').select('id')
        .or(`patient_id.eq.${u.id},caregiver_id.eq.${u.id}`).is('revoked_at', null).limit(1);
      if (careError) throw careError;
      if (careLinks?.length) continue;
      const { error: delError } = await admin.auth.admin.deleteUser(u.id);
      if (!delError) deleted++;
    }
    if (users.length < 1000) break;
    page++;
  }
  return json({ ok: true, deleted });
});
