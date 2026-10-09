// «Que pague mi familiar o cuidador/a».
//
// La persona mayor crea desde la app un enlace y se lo envía a un familiar (WhatsApp, SMS…). Quien lo abre paga en la
// página segura de Stripe (tarjeta, Apple Pay o Google Pay) y MediClaro Premium se activa en la cuenta de la persona
// mayor (el webhook de Stripe lo aplica). El familiar no necesita cuenta de MediClaro y no ve ningún dato de salud,
// medicamento ni conversación: solo el nombre de pila y el plan que paga. Del enlace solo se guarda su huella (SHA-256).
//
// Desplegar con:  npx supabase functions deploy family-pay --no-verify-jwt   (el enlace lo abre alguien sin sesión)
//   POST {action:'create', planId}  (con sesión de la persona mayor)  → { url, expiresAt, beneficiaryName }
//   GET  ?t=<token>                  → 303 a la página de pago de Stripe (o un aviso en texto si ya no vale)
//   GET  ?t=<token>&done=1           → «Gracias» (o redirige a FAMILY_PAY_DONE_URL si se configura)
// Variables opcionales: FAMILY_PAY_PUBLIC_URL (enlace con dominio propio que llegue a esta función),
// FAMILY_PAY_DONE_URL (página propia de «gracias»), STRIPE_PRICE_QUARTERLY y STRIPE_PRICE_ANNUAL (precios de Stripe
// de esos planes; sin ellas solo se ofrece el mensual, como en create-checkout).
import { admin, cors, fail, getUser, json, rateLimit } from '../_shared/common.ts';
import { stripe, PRICE_BASE } from '../_shared/stripe.ts';
import { planById, type Period } from '../_shared/plans.ts';

const INVITE_DAYS = 7;
const PREMIUM_STATUSES = ['active', 'trialing', 'past_due'];

const PRICE_FOR: Record<Period, string | undefined> = {
  monthly: PRICE_BASE,
  quarterly: Deno.env.get('STRIPE_PRICE_QUARTERLY') || undefined,
  annual: Deno.env.get('STRIPE_PRICE_ANNUAL') || undefined,
};

function selfUrl(): string {
  return (Deno.env.get('FAMILY_PAY_PUBLIC_URL') || `${Deno.env.get('SUPABASE_URL')}/functions/v1/family-pay`).replace(/\/$/, '');
}

/** Respuesta para quien abre el enlace en el navegador (texto plano: el dominio de Supabase no sirve HTML). */
function text(message: string, status = 200): Response {
  return new Response(message, {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  });
}

function redirect(url: string): Response {
  return new Response(null, { status: 303, headers: { Location: url, 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' } });
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function firstName(name: unknown): string | null {
  const n = typeof name === 'string' ? name.trim().split(/\s+/)[0] : '';
  return n ? n.slice(0, 40) : null;
}

async function isPremium(userId: string): Promise<boolean> {
  const { data } = await admin.from('profiles').select('plan, subscription_status').eq('id', userId).maybeSingle();
  return data?.plan === 'premium' && PREMIUM_STATUSES.includes(data.subscription_status);
}

/** La persona mayor crea (o renueva) su invitación. Solo queda viva la última. */
async function create(req: Request): Promise<Response> {
  const user = await getUser(req);
  if (!user) return fail('Sesión caducada. Vuelva a entrar.', 401);
  if (!(await rateLimit(user.id, 'family-pay', 5))) return fail('Demasiadas peticiones. Espere un momento.', 429);
  const body = await req.json().catch(() => ({}));
  if (body?.action !== 'create') return fail('Acción no válida');
  if (await isPremium(user.id)) return fail('Ya tiene una suscripción activa.', 409);
  const plan = await planById(body.planId);
  if (!plan || !PRICE_FOR[plan.period]) {
    return fail('Este plan no lo puede pagar un familiar ahora mismo.', 400, 'PLAN_NOT_AVAILABLE');
  }
  const { data: prof } = await admin.from('profiles').select('display_name').eq('id', user.id).maybeSingle();
  const name = firstName(prof?.display_name);
  const now = new Date();
  const { error: revokeError } = await admin
    .from('family_pay_invites')
    .update({ revoked_at: now.toISOString() })
    .eq('beneficiary_id', user.id)
    .is('paid_at', null)
    .is('revoked_at', null);
  if (revokeError) throw revokeError;
  const token = newToken();
  const expiresAt = new Date(now.getTime() + INVITE_DAYS * 86_400_000).toISOString();
  const { error } = await admin.from('family_pay_invites').insert({
    token_hash: await sha256(token),
    beneficiary_id: user.id,
    beneficiary_name: name,
    plan_id: plan.id,
    expires_at: expiresAt,
  });
  if (error) throw error;
  return json({ url: `${selfUrl()}?t=${token}`, expiresAt, beneficiaryName: name, planId: plan.id });
}

/** El familiar abre el enlace: va a la página de pago de Stripe, a un «gracias» o a un aviso claro. */
async function open(url: URL): Promise<Response> {
  const token = url.searchParams.get('t') ?? '';
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) {
    return text('Este enlace no es válido. Pide que te envíen uno nuevo desde MediClaro.', 400);
  }
  const { data: invite, error } = await admin.from('family_pay_invites').select('*').eq('token_hash', await sha256(token)).maybeSingle();
  if (error) throw error;
  if (!invite || invite.revoked_at || Date.parse(invite.expires_at) < Date.now()) {
    return text('Esta invitación ha caducado o ya no es válida. Pide que te envíen una nueva desde MediClaro.', 410);
  }
  const who = invite.beneficiary_name || 'Tu familiar';
  if (url.searchParams.get('done') === '1') {
    const done = Deno.env.get('FAMILY_PAY_DONE_URL');
    if (done && /^https:\/\//.test(done)) return redirect(done);
    return text(
      `¡Gracias! El pago se ha completado.\n\nMediClaro Premium se activará en el móvil de ${who} en unos segundos. ` +
        'Recibirás el recibo en tu correo.\n\nPara cambiar la tarjeta o cancelar la suscripción, usa el enlace del correo de Stripe.',
    );
  }
  if (url.searchParams.get('cancel') === '1') {
    return text('No se ha realizado ningún pago. Puedes volver a abrir el enlace cuando quieras.');
  }
  if (invite.paid_at || (await isPremium(invite.beneficiary_id))) {
    return text(`${who} ya tiene MediClaro Premium. No hace falta pagar nada.`);
  }
  const plan = await planById(invite.plan_id);
  const price = plan ? PRICE_FOR[plan.period] : undefined;
  if (!plan || !price) return text('Este plan ya no está disponible. Pide que te envíen una invitación nueva.', 410);

  // Si ya hay una página de pago abierta para esta invitación, se reutiliza (no se crean páginas sin fin).
  if (invite.checkout_session_id) {
    const previous = await stripe.checkout.sessions.retrieve(invite.checkout_session_id).catch(() => null);
    if (previous?.status === 'open' && previous.url) return redirect(previous.url);
  }
  const link = `${selfUrl()}?t=${token}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    client_reference_id: invite.beneficiary_id,
    line_items: [{ price, quantity: 1 }],
    subscription_data: { metadata: { supabase_user_id: invite.beneficiary_id, paid_by: 'family', family_invite: invite.id } },
    metadata: { kind: 'family', family_invite: invite.id, supabase_user_id: invite.beneficiary_id },
    custom_text: {
      submit: {
        message: `Pagas la suscripción MediClaro Premium de ${who}. ${who} disfrutará de todas las ventajas. No verás sus conversaciones ni su información médica.`,
      },
    },
    billing_address_collection: 'auto',
    allow_promotion_codes: true,
    automatic_tax: { enabled: Deno.env.get('STRIPE_AUTOMATIC_TAX') === 'true' },
    locale: 'es',
    success_url: `${link}&done=1`,
    cancel_url: `${link}&cancel=1`,
  });
  const { error: saveError } = await admin.from('family_pay_invites').update({ checkout_session_id: session.id }).eq('id', invite.id);
  if (saveError) throw saveError;
  if (!session.url) throw new Error('Stripe no ha devuelto la página de pago');
  return redirect(session.url);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    if (req.method === 'POST') return await create(req);
    if (req.method === 'GET') return await open(new URL(req.url));
    return fail('Método no permitido', 405);
  } catch (e) {
    console.error('family-pay', e);
    return req.method === 'GET'
      ? text('Ahora mismo no se puede abrir el pago. Inténtalo de nuevo en unos minutos.', 500)
      : fail('Ha ocurrido un error. Inténtelo de nuevo.', 500);
  }
});
