// Derechos RGPD: exportar mis datos y eliminar mi cuenta.
//
// ── PROPUESTA (NO APLICADA) ──────────────────────────────────────────────────────────────────────────
// Cambios respecto a supabase/functions/account/index.ts (marcados con «PARCHE»), solo en «export» (R-06):
//   · Añade el perfil de emergencia (datos de salud declarados), los vínculos de cuidadores, el teléfono con
//     el que se entra, la actividad de uso y el registro de seguridad de la propia persona.
//   · Si alguna consulta falla, responde error (500) en lugar de entregar un archivo incompleto como completo.
// «delete» no cambia. Pruebas: backend-patches/tests/functions (deno test).
// ─────────────────────────────────────────────────────────────────────────────────────────────────────
import { admin, fail, handler, json } from '../_shared/common.ts';
import { stripe } from '../_shared/stripe.ts';

Deno.serve(handler({ bucket: 'account', maxPerMinute: 3 }, async (_req, user, body) => {
  const action = body.action;

  if (action === 'export') {
    const results = await Promise.all([
      admin.from('profiles').select('display_name, locale, font_size, easy_mode, speech_rate, sub_state, created_at').eq('id', user.id).single(),
      admin.from('scans').select('nombre, nregistro, status, created_at').eq('user_id', user.id),
      admin.from('saved_medications').select('nombre, nregistro, principio_activo, presentacion, favorito, created_at').eq('user_id', user.id),
      admin.from('consents').select('kind, version, granted, created_at').eq('user_id', user.id),
      // PARCHE R-06
      admin.from('emergency_profiles').select('*').eq('user_id', user.id).maybeSingle(),
      admin.from('caregiver_links').select('caregiver_email, status, scopes, created_at').or(`owner_id.eq.${user.id},caregiver_id.eq.${user.id}`),
      admin.from('usage_events').select('kind, detail, created_at').eq('user_id', user.id),
      admin.from('audit_log').select('action, created_at').eq('user_id', user.id),
    ]);
    // PARCHE: nunca un archivo incompleto presentado como completo.
    const failed = results.find((r) => r.error);
    if (failed) throw failed.error;
    const [profile, scans, meds, consents, emergency, caregivers, usage, audit] = results;
    await admin.from('audit_log').insert({ user_id: user.id, action: 'data_exported' });
    return json({ exportedAt: new Date().toISOString(), email: user.email, phone: user.phone ?? null,
      profile: profile.data, history: scans.data, myMedications: meds.data, consents: consents.data,
      emergencyProfile: emergency.data ?? null, caregivers: caregivers.data ?? [],
      usageEvents: usage.data ?? [], securityLog: audit.data ?? [] });
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
