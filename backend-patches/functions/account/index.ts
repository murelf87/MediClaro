// Derechos RGPD: exportar mis datos y eliminar mi cuenta.
//
// ── PROPUESTA (NO APLICADA) ──────────────────────────────────────────────────────────────────────────
// Cambios respecto a supabase/functions/account/index.ts (marcados con «PARCHE»):
//
// «export» (R-06):
//   · Añade el perfil de emergencia (datos de salud declarados), los vínculos de cuidadores, el teléfono con
//     el que se entra, la actividad de uso y el registro de seguridad de la propia persona.
//   · Si alguna consulta falla, responde error (500) en lugar de entregar un archivo incompleto como completo.
//
// «delete» (R-19 · requiere la migración 20261012210000_r19_billing_requests.sql ANTES de desplegar):
//   · NO borra la cuenta si no ha podido parar el cobro. Hoy, si la cancelación en Stripe falla, el error se
//     anota en la consola y la cuenta se borra igualmente: la persona se queda sin cuenta y con la
//     suscripción renovándose, sin ninguna forma de pararla. Ahora responde 409 y no borra nada.
//   · No llama a Stripe con identificadores que no son suyos (`bizum-…`, `courtesy-…`): un pago con Bizum no
//     se renueva nunca y un acceso de cortesía no tiene cobro, así que no hay nada que cancelar.
//   · Deja constancia de la solicitud en `billing_requests` antes de borrar (sobrevive al borrado), para
//     poder atender una devolución pendiente y acreditar que se atendió.
//   · Una suscripción de Apple o de Google Play NO impide eliminar la cuenta: eso lo exigen tanto la norma
//     5.1.1(v) de Apple como el derecho de supresión. Se registra que seguía activa; avisar a la persona es
//     cosa de la app, que lo hace antes de llamar aquí.
//
// Pruebas: backend-patches/tests/functions (deno test).
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
    const { data: p } = await admin
      .from('profiles')
      .select('stripe_customer_id, subscription_id, billing_provider, plan, subscription_status, current_period_end')
      .eq('id', user.id)
      .single();

    // PARCHE R-19: ¿hay una suscripción de Stripe de verdad que haya que parar?
    // `bizum-…` es un pago único que no se renueva y `courtesy-…` es un acceso regalado: no existen en
    // Stripe, y pedirle que los cancele devuelve un error que antes hacía creer que no se podía borrar.
    // Cuentas antiguas pueden no tener `billing_provider`: se descarta solo lo que seguro no es de Stripe.
    const subId = typeof p?.subscription_id === 'string' ? p.subscription_id : null;
    const cancellableInStripe =
      !!subId &&
      !subId.startsWith('bizum-') &&
      !subId.startsWith('courtesy-') &&
      p?.billing_provider !== 'apple' &&
      p?.billing_provider !== 'google';
    const storeSubscriptionActive =
      (p?.billing_provider === 'apple' || p?.billing_provider === 'google') &&
      p?.plan === 'premium' &&
      ['active', 'trialing', 'past_due'].includes(String(p?.subscription_status));

    // PARCHE R-19: nunca se borra una cuenta dejando un cobro vivo que ya nadie podrá parar.
    if (cancellableInStripe && subId) {
      try {
        await stripe.subscriptions.cancel(subId);
      } catch (e) {
        console.error('cancel sub', e);
        return fail(
          'No hemos podido cancelar tu suscripción, así que no eliminamos la cuenta todavía: si lo hiciéramos, te seguirían cobrando y no podrías evitarlo. Inténtalo de nuevo en unos minutos.',
          409,
          'CANCEL_FAILED',
        );
      }
    }

    // PARCHE R-19: constancia de la solicitud ANTES de borrar. Sobrevive al borrado (la clave ajena es
    // `on delete set null`), porque puede quedar pendiente una devolución por desistimiento.
    const { error: reqError } = await admin.from('billing_requests').insert({
      user_id: user.id,
      user_ref: await userRef(user.id),
      kind: 'account_deletion',
      provider: p?.billing_provider ?? null,
      store_subscription_active: storeSubscriptionActive,
      status: 'pending',
    });
    // Si el registro falla, no se borra: sin rastro no habría forma de atender una devolución pendiente.
    if (reqError) throw reqError;

    // Borrar el usuario (ON DELETE CASCADE borra perfil, historial, medicamentos y consentimientos)
    await admin.from('audit_log').insert({ user_id: user.id, action: 'account_deleted' });
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    // Las facturas de Stripe se conservan por obligación fiscal; el cliente queda sin datos de la app.
    // `storeSubscriptionActive` se devuelve para que la app pueda recordar dónde cancelarla; NO impide borrar.
    return json({ deleted: true, storeSubscriptionActive });
  }

  // PARCHE R-19: registrar una solicitud de desistimiento o de no renovar, sin eliminar la cuenta.
  if (action === 'request') {
    const kind = body.kind;
    if (kind !== 'withdrawal' && kind !== 'cancel_renewal') return fail('Solicitud no válida');
    const { data: p } = await admin
      .from('profiles')
      .select('billing_provider, subscription_id')
      .eq('id', user.id)
      .single();
    const { error } = await admin.from('billing_requests').insert({
      user_id: user.id,
      user_ref: await userRef(user.id),
      kind,
      provider: p?.billing_provider ?? null,
      plan_id: typeof body.planId === 'string' ? body.planId : null,
      status: 'pending',
    });
    if (error) throw error;
    return json({ recorded: true });
  }

  return fail('Acción no válida');
}));

/** Identificador interno de la solicitud: SHA-256 del id de usuario. No se guarda el id en claro. */
export async function userRef(userId: string): Promise<string> {
  const bytes = new TextEncoder().encode(userId);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}
