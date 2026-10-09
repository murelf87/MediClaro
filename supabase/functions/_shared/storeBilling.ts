import { Buffer } from 'node:buffer';
import { Environment, SignedDataVerifier } from 'npm:@apple/app-store-server-library@3.1.0';
import { admin, HttpError } from './common.ts';
import { APPLE_ROOT_G2_B64, APPLE_ROOT_G3_B64 } from './appleRoots.ts';

type Platform = 'apple' | 'google';
export type VerifiedStoreSubscription = {
  platform: Platform;
  storeKey: string;
  productId: string;
  basePlanId: string | null;
  planId: string | null;
  status: 'active' | 'past_due' | 'expired' | 'canceled' | 'pending';
  entitlementActive: boolean;
  expiresAt: string | null;
  startedAt: string | null;
  autoRenew: boolean | null;
  environment: string | null;
  accountToken: string | null;
};

type StorePlan = { id?: string; store?: { apple?: { productId?: string } | null; google?: { productId?: string; basePlanId?: string | null } | null } | null };

function bytesToB64url(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
const enc = (s: string) => bytesToB64url(new TextEncoder().encode(s));
function b64urlJson(part: string): any {
  try {
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(b64), c => c.charCodeAt(0))));
  } catch { return null; }
}
export function decodeJwsPayload(jws: string | null | undefined): any {
  const parts = String(jws ?? '').split('.');
  return parts.length === 3 ? b64urlJson(parts[1]) : null;
}
function pemBytes(pem: string): Uint8Array {
  const clean = pem.replace(/\\n/g, '\n').replace(/-----BEGIN [^-]+-----/g, '').replace(/-----END [^-]+-----/g, '').replace(/\s+/g, '');
  return Uint8Array.from(atob(clean), c => c.charCodeAt(0));
}
async function signJwt(header: object, payload: object, pem: string, kind: 'ES256' | 'RS256'): Promise<string> {
  const input = `${enc(JSON.stringify(header))}.${enc(JSON.stringify(payload))}`;
  const key = await crypto.subtle.importKey(
    'pkcs8', pemBytes(pem),
    kind === 'ES256' ? { name: 'ECDSA', namedCurve: 'P-256' } : { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign'],
  );
  const signature = await crypto.subtle.sign(
    kind === 'ES256' ? { name: 'ECDSA', hash: 'SHA-256' } : { name: 'RSASSA-PKCS1-v1_5' },
    key, new TextEncoder().encode(input),
  );
  return `${input}.${bytesToB64url(new Uint8Array(signature))}`;
}

async function configuredPlans(): Promise<StorePlan[]> {
  const { data } = await admin.from('app_config').select('value').eq('key', 'plans').maybeSingle();
  const plans = data?.value?.plans;
  return Array.isArray(plans) ? plans : [];
}
async function planFor(platform: Platform, productId: string, basePlanId: string | null): Promise<string | null> {
  for (const p of await configuredPlans()) {
    const s = p.store?.[platform];
    if (!s || s.productId !== productId) continue;
    if (platform === 'google' && s.basePlanId && basePlanId && s.basePlanId !== basePlanId) continue;
    if (platform === 'google' && s.basePlanId && !basePlanId) continue;
    return p.id ?? null;
  }
  return null;
}

const APPLE_BUNDLE_ID = Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.mediclaro.app';
const APPLE_APP_ID = Number(Deno.env.get('APPLE_APP_ID') ?? '6817669616');
const APPLE_ROOTS = [Buffer.from(APPLE_ROOT_G2_B64, 'base64'), Buffer.from(APPLE_ROOT_G3_B64, 'base64')];
let appleSandboxVerifier: SignedDataVerifier | null = null;
let appleProductionVerifier: SignedDataVerifier | null = null;

function appleEnvironment(value: unknown): Environment | null {
  return value === Environment.SANDBOX || value === 'Sandbox'
    ? Environment.SANDBOX
    : value === Environment.PRODUCTION || value === 'Production'
      ? Environment.PRODUCTION
      : null;
}

function appleVerifier(environment: Environment): SignedDataVerifier {
  if (environment === Environment.SANDBOX) {
    appleSandboxVerifier ??= new SignedDataVerifier(APPLE_ROOTS, true, Environment.SANDBOX, APPLE_BUNDLE_ID);
    return appleSandboxVerifier;
  }
  if (!Number.isFinite(APPLE_APP_ID) || APPLE_APP_ID <= 0) {
    throw new HttpError(503, 'STORE_NOT_CONFIGURED', 'Falta el identificador de la aplicación de Apple.');
  }
  appleProductionVerifier ??= new SignedDataVerifier(APPLE_ROOTS, true, Environment.PRODUCTION, APPLE_BUNDLE_ID, APPLE_APP_ID);
  return appleProductionVerifier;
}

async function verifyAppleJws(signedTransaction: string): Promise<any> {
  if (!signedTransaction || signedTransaction.length > 30000 || signedTransaction.split('.').length !== 3) {
    throw new HttpError(400, 'INVALID_PURCHASE', 'Transacción firmada de Apple no válida.');
  }
  const unsafe = decodeJwsPayload(signedTransaction);
  const environment = appleEnvironment(unsafe?.environment);
  if (!environment) throw new HttpError(400, 'INVALID_PURCHASE', 'Apple no indicó un entorno válido para la compra.');
  try {
    return await appleVerifier(environment).verifyAndDecodeTransaction(signedTransaction);
  } catch (e) {
    console.error('apple transaction JWS verification failed', e);
    throw new HttpError(400, 'INVALID_PURCHASE', 'Apple no ha confirmado la firma de esta compra.');
  }
}

export async function verifyAppleNotificationPayload(signedPayload: string): Promise<any> {
  if (!signedPayload || signedPayload.length > 100000 || signedPayload.split('.').length !== 3) {
    throw new HttpError(400, 'INVALID_NOTIFICATION', 'Notificación de Apple no válida.');
  }
  const unsafe = decodeJwsPayload(signedPayload);
  const environment = appleEnvironment(unsafe?.data?.environment ?? unsafe?.summary?.environment ?? unsafe?.appData?.environment);
  if (!environment) throw new HttpError(400, 'INVALID_NOTIFICATION', 'Apple no indicó un entorno válido en la notificación.');
  try {
    return await appleVerifier(environment).verifyAndDecodeNotification(signedPayload);
  } catch (e) {
    console.error('apple notification JWS verification failed', e);
    throw new HttpError(400, 'INVALID_NOTIFICATION', 'No se ha podido verificar la firma de la notificación de Apple.');
  }
}

export async function verifyApple(signedTransaction: string, userId?: string): Promise<VerifiedStoreSubscription> {
  const tx = await verifyAppleJws(signedTransaction);
  if (!tx?.transactionId || !tx?.originalTransactionId || !tx?.productId) {
    throw new HttpError(400, 'INVALID_PURCHASE', 'Apple devolvió una transacción incompleta.');
  }
  const accountToken = String(tx.appAccountToken ?? '').toLowerCase() || null;
  if (userId && accountToken !== userId.toLowerCase()) {
    throw new HttpError(409, 'STORE_ACCOUNT_MISMATCH', 'Esta compra de Apple está vinculada a otra cuenta de MediClaro.');
  }
  const planId = await planFor('apple', String(tx.productId), null);
  if (!planId) throw new HttpError(400, 'UNKNOWN_PRODUCT', 'El producto de Apple no está configurado en MediClaro.');
  const expiresMs = tx.expiresDate == null ? null : Number(tx.expiresDate);
  if (!expiresMs || !Number.isFinite(expiresMs)) {
    throw new HttpError(400, 'INVALID_PURCHASE', 'La suscripción de Apple no contiene una fecha de vencimiento válida.');
  }
  const revoked = tx.revocationDate != null;
  const future = expiresMs > Date.now();
  const status: VerifiedStoreSubscription['status'] = revoked ? 'canceled' : future ? 'active' : 'expired';
  return {
    platform: 'apple', storeKey: String(tx.originalTransactionId), productId: String(tx.productId), basePlanId: null, planId,
    status, entitlementActive: !revoked && future,
    expiresAt: new Date(expiresMs).toISOString(),
    startedAt: tx.originalPurchaseDate ? new Date(Number(tx.originalPurchaseDate)).toISOString() : tx.purchaseDate ? new Date(Number(tx.purchaseDate)).toISOString() : null,
    autoRenew: null, environment: String(tx.environment ?? ''), accountToken,
  };
}

async function googleAccessToken(): Promise<string> {
  const raw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT_JSON');
  if (!raw) throw new HttpError(503, 'STORE_NOT_CONFIGURED', 'Google Play no está configurado en el servidor.');
  let sa: any;
  try { sa = JSON.parse(raw); } catch { throw new HttpError(503, 'STORE_NOT_CONFIGURED', 'La cuenta de servicio de Google Play no es válida.'); }
  if (!sa.client_email || !sa.private_key) throw new HttpError(503, 'STORE_NOT_CONFIGURED', 'Faltan datos de la cuenta de servicio de Google Play.');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await signJwt({ alg: 'RS256', typ: 'JWT' }, {
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/androidpublisher', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }, sa.private_key, 'RS256');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion }), signal: AbortSignal.timeout(10000),
  });
  const d = await r.json().catch(() => null);
  if (!r.ok || !d?.access_token) throw new HttpError(503, 'STORE_NOT_CONFIGURED', 'Google Play no ha autorizado la verificación del servidor.');
  return String(d.access_token);
}

async function googleApi(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const token = await googleAccessToken();
  const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3${path}`, {
    ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(10000),
  });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}

function googleState(raw: string, expiresAt: string | null): Pick<VerifiedStoreSubscription, 'status' | 'entitlementActive'> {
  const future = expiresAt ? new Date(expiresAt).getTime() > Date.now() : false;
  if (raw === 'SUBSCRIPTION_STATE_ACTIVE' && future) return { status: 'active', entitlementActive: true };
  if (raw === 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' && future) return { status: 'past_due', entitlementActive: true };
  if (raw === 'SUBSCRIPTION_STATE_CANCELED' && future) return { status: 'active', entitlementActive: true };
  if (raw === 'SUBSCRIPTION_STATE_PENDING') return { status: 'pending', entitlementActive: false };
  return { status: 'expired', entitlementActive: false };
}

export async function verifyGoogle(purchaseToken: string, userId?: string): Promise<VerifiedStoreSubscription> {
  if (!purchaseToken || purchaseToken.length > 4096) throw new HttpError(400, 'INVALID_PURCHASE', 'Token de Google Play no válido.');
  const pkg = Deno.env.get('ANDROID_PACKAGE_NAME') ?? 'com.mediclaro.app';
  const res = await googleApi(`/applications/${encodeURIComponent(pkg)}/purchases/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`);
  if (!res.ok) throw new HttpError(400, 'INVALID_PURCHASE', 'Google Play no ha confirmado esta compra.');
  const d = res.data ?? {};
  const line = (d.lineItems ?? []).slice().sort((a: any, b: any) => new Date(b.expiryTime ?? 0).getTime() - new Date(a.expiryTime ?? 0).getTime())[0];
  if (!line?.productId) throw new HttpError(400, 'INVALID_PURCHASE', 'Google Play devolvió una suscripción incompleta.');
  const accountToken = String(d.externalAccountIdentifiers?.obfuscatedExternalAccountId ?? '').toLowerCase() || null;
  if (userId && accountToken !== userId.toLowerCase()) throw new HttpError(409, 'STORE_ACCOUNT_MISMATCH', 'Esta compra de Google Play está vinculada a otra cuenta de MediClaro.');
  const basePlanId = line.offerDetails?.basePlanId ? String(line.offerDetails.basePlanId) : null;
  const planId = await planFor('google', String(line.productId), basePlanId);
  if (!planId) throw new HttpError(400, 'UNKNOWN_PRODUCT', 'El producto o plan base de Google Play no está configurado en MediClaro.');
  const expiresAt = line.expiryTime ? new Date(line.expiryTime).toISOString() : null;
  const state = googleState(String(d.subscriptionState ?? ''), expiresAt);
  const autoRenew = line.autoRenewingPlan?.autoRenewEnabled == null ? null : !!line.autoRenewingPlan.autoRenewEnabled;

  if (d.acknowledgementState === 'ACKNOWLEDGEMENT_STATE_PENDING' && state.entitlementActive) {
    const ack = await googleApi(`/applications/${encodeURIComponent(pkg)}/purchases/subscriptions/${encodeURIComponent(String(line.productId))}/tokens/${encodeURIComponent(purchaseToken)}:acknowledge`, { method: 'POST', body: '{}' });
    if (!ack.ok && ack.status !== 409) throw new HttpError(503, 'STORE_ACK_FAILED', 'Google Play confirmó la compra, pero no se pudo reconocer todavía.');
  }

  return {
    platform: 'google', storeKey: purchaseToken, productId: String(line.productId), basePlanId, planId,
    status: state.status, entitlementActive: state.entitlementActive, expiresAt,
    startedAt: d.startTime ? new Date(d.startTime).toISOString() : null, autoRenew,
    environment: d.testPurchase ? 'Sandbox' : 'Production', accountToken,
  };
}

export async function applyVerifiedSubscription(userId: string, sub: VerifiedStoreSubscription): Promise<void> {
  const profileStatus = sub.entitlementActive ? (sub.status === 'past_due' ? 'past_due' : 'active') : sub.status === 'canceled' ? 'canceled' : 'incomplete_expired';
  const { error: upsertError } = await admin.from('store_subscriptions').upsert({
    user_id: userId, platform: sub.platform, store_key: sub.storeKey, product_id: sub.productId, base_plan_id: sub.basePlanId,
    plan_id: sub.planId, status: sub.status, environment: sub.environment, expires_at: sub.expiresAt, auto_renew: sub.autoRenew,
    last_verified_at: new Date().toISOString(),
  }, { onConflict: 'platform,store_key' });
  if (upsertError) throw upsertError;

  const { error } = await admin.from('profiles').update({
    plan: sub.entitlementActive ? 'premium' : 'free', billing_provider: sub.platform, subscription_id: sub.storeKey,
    subscription_status: profileStatus, current_period_start: sub.startedAt, current_period_end: sub.expiresAt,
    cancel_at_period_end: sub.entitlementActive && sub.autoRenew === false, updated_at: new Date().toISOString(),
  }).eq('id', userId);
  if (error) throw error;
}

export async function userForStoreKey(platform: Platform, storeKey: string): Promise<string | null> {
  const { data } = await admin.from('store_subscriptions').select('user_id').eq('platform', platform).eq('store_key', storeKey).maybeSingle();
  return data?.user_id ?? null;
}

export async function storeEventSeen(platform: Platform, eventId: string): Promise<boolean> {
  const { data } = await admin.from('store_events').select('event_id').eq('platform', platform).eq('event_id', eventId).maybeSingle();
  return !!data;
}

export async function markStoreEvent(platform: Platform, eventId: string, eventType: string | null): Promise<void> {
  await admin.from('store_events').upsert({ platform, event_id: eventId, event_type: eventType }, { onConflict: 'platform,event_id' });
}
