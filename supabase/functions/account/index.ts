// Derechos RGPD: exportar mis datos y eliminar mi cuenta.
import { admin, fail, handler, json } from '../_shared/common.ts';
import { stripe } from '../_shared/stripe.ts';

Deno.serve(handler({ bucket: 'account', maxPerMinute: 3 }, async (_req, user, body) => {
  const action = body.action;

  if (action === 'export') {
    const [profile, scans, meds, consents] = await Promise.all([
      admin.from('profiles').select('display_name, locale, font_size, easy_mode, speech_rate, sub_state, created_at').eq('id', user.id).single(),
      admin.from('scans').select('nombre, nregistro, status, created_at').eq('user_id', user.id),
      admin.from('saved_medications').select('nombre, nregistro, principio_activo, presentacion, favorito, created_at').eq('user_id', user.id),
      admin.from('consents').select('kind, version, granted, created_at').eq('user_id', user.id),
    ]);
    await admin.from('audit_log').insert({ user_id: user.id, action: 'data_exported' });
    return json({ exportedAt: new Date().toISOString(), email: user.email,
      profile: profile.data, history: scans.data, myMedications: meds.data, consents: consents.data });
  }

  if (action === 'delete') {
    if (body.confirm !== 'ELIMINAR') return fail('Confirmación no válida');
    const { data: p } = await admin.from('profiles').select('stripe_customer_id, subscription_id').eq('id', user.id).single();
    // 1) Cancelar cobros inmediatamente
    if (p?.subscription_id) {
      try { await stripe.subscriptions.cancel(p.subscription_id); } catch (e) { console.error('cancel sub', e); }
    }
    // 2) Borrar el usuario (ON DELETE CASCADE borra perfil, historial, medicamentos y consentimientos)
    await admin.from('audit_log').insert({ user_id: user.id, action: 'account_deleted' });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    // Las facturas de Stripe se conservan por obligación fiscal; el cliente queda sin datos de la app.
    return json({ deleted: true });
  }

  return fail('Acción no válida');
}));
