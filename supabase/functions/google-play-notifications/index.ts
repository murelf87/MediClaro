import { json } from '../_shared/common.ts';
import { applyVerifiedSubscription, markStoreEvent, storeEventSeen, userForStoreKey, verifyGoogle } from '../_shared/storeBilling.ts';

function decodeData(data: string): any {
  try { return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data), c => c.charCodeAt(0)))); } catch { return null; }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const secret = Deno.env.get('GOOGLE_RTDN_TOKEN');
  if (!secret) return json({ error: 'notification endpoint not configured' }, 503);
  if (new URL(req.url).searchParams.get('token') !== secret) return json({ error: 'unauthorized' }, 401);
  const envelope = await req.json().catch(() => null);
  const messageId = String(envelope?.message?.messageId ?? '');
  const notice = decodeData(String(envelope?.message?.data ?? ''));
  if (!notice) return json({ error: 'invalid payload' }, 400);
  if (notice.testNotification) return json({ ok: true, test: true });
  const purchaseToken = String(notice.subscriptionNotification?.purchaseToken ?? '');
  if (!purchaseToken) return json({ ok: true });
  const eventId = messageId || `${notice.eventTimeMillis ?? ''}:${purchaseToken}:${notice.subscriptionNotification?.notificationType ?? ''}`;
  if (await storeEventSeen('google', eventId)) return json({ ok: true, duplicate: true });
  try {
    const sub = await verifyGoogle(purchaseToken);
    const userId = sub.accountToken ?? await userForStoreKey('google', purchaseToken);
    if (userId) await applyVerifiedSubscription(userId, sub);
    await markStoreEvent('google', eventId, String(notice.subscriptionNotification?.notificationType ?? ''));
    return json({ ok: true });
  } catch (e) {
    console.error('google notification verification failed', e);
    return json({ error: 'verification failed' }, 503);
  }
});
