import { admin, fail, handler, json } from '../_shared/common.ts';
import { stripe } from '../_shared/stripe.ts';

Deno.serve(handler({ bucket: 'portal', maxPerMinute: 5 }, async (_req, user, body) => {
  const returnUrl = String(body.returnUrl ?? 'mediclaro://subscribe');
  if (!/^(mediclaro:\/\/|exp:\/\/|https:\/\/)/.test(returnUrl)) return fail('URL de retorno no válida');
  const { data: prof } = await admin.from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  if (!prof?.stripe_customer_id) return fail('No tiene ninguna suscripción.', 404);
  const s = await stripe.billingPortal.sessions.create({ customer: prof.stripe_customer_id, return_url: returnUrl, locale: 'es' });
  return json({ url: s.url });
}));
