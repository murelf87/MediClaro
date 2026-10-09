import { json } from '../_shared/common.ts';
import { applyVerifiedSubscription, decodeJwsPayload, markStoreEvent, storeEventSeen, userForStoreKey, verifyApple, verifyAppleNotificationPayload } from '../_shared/storeBilling.ts';

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const body = await req.json().catch(() => null);
  const signedPayload = typeof body?.signedPayload === 'string' ? body.signedPayload : '';
  if (!signedPayload) return json({ error: 'invalid payload' }, 400);

  try {
    // La firma JWS de Apple autentica la notificación; no dependemos de un secreto en la URL.
    const outer = await verifyAppleNotificationPayload(signedPayload);
    const signedTransaction = typeof outer?.data?.signedTransactionInfo === 'string' ? outer.data.signedTransactionInfo : '';
    if (!signedTransaction) return json({ ok: true }); // p. ej. notificación TEST sin transacción.

    const tx = decodeJwsPayload(signedTransaction);
    const transactionId = String(tx?.transactionId ?? tx?.originalTransactionId ?? '');
    const original = String(tx?.originalTransactionId ?? transactionId);
    if (!transactionId) return json({ error: 'invalid transaction' }, 400);

    const eventId = String(outer.notificationUUID ?? `${outer.signedDate ?? ''}:${transactionId}`);
    if (await storeEventSeen('apple', eventId)) return json({ ok: true, duplicate: true });

    const sub = await verifyApple(signedTransaction);
    const userId = sub.accountToken ?? await userForStoreKey('apple', original);
    if (userId) await applyVerifiedSubscription(userId, sub);
    await markStoreEvent('apple', eventId, String(outer.notificationType ?? ''));
    return json({ ok: true });
  } catch (e) {
    console.error('apple notification verification failed', e);
    return json({ error: 'verification failed' }, 503);
  }
});
