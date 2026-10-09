import { fail, handler, json } from '../_shared/common.ts';
import { applyVerifiedSubscription, decodeJwsPayload, verifyApple, verifyGoogle } from '../_shared/storeBilling.ts';

Deno.serve(handler({ bucket: 'iap-verify', maxPerMinute: 12, maxBodyBytes: 16_000 }, async (_req, user, body) => {
  const platform = body.platform === 'apple' || body.platform === 'google' ? body.platform : null;
  if (!platform) return fail('Plataforma de compra no válida');
  if (body.accountToken && String(body.accountToken).toLowerCase() !== user.id.toLowerCase()) {
    return fail('La compra no corresponde a esta cuenta.', 409, 'STORE_ACCOUNT_MISMATCH');
  }

  let sub;
  if (platform === 'apple') {
    const signedTransaction = typeof body.purchaseToken === 'string' ? body.purchaseToken : '';
    const fromJws = decodeJwsPayload(signedTransaction);
    if (body.productId && String(body.productId) !== String(fromJws?.productId ?? '')) {
      return fail('El producto no coincide con la transacción de Apple.', 400, 'INVALID_PURCHASE');
    }
    sub = await verifyApple(signedTransaction, user.id);
  } else {
    sub = await verifyGoogle(String(body.purchaseToken ?? ''), user.id);
  }
  await applyVerifiedSubscription(user.id, sub);
  return json({ ok: true, isPremium: sub.entitlementActive, active: sub.entitlementActive, plan: sub.entitlementActive ? 'premium' : 'free', provider: sub.platform, status: sub.status, planId: sub.planId, expiresAt: sub.expiresAt, currentPeriodEnd: sub.expiresAt });
}));
