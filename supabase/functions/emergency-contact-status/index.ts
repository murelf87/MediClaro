import { admin, fail, handler, json } from '../_shared/common.ts';
import { requirePremium } from '../_shared/entitlements.ts';

Deno.serve(handler({ bucket: 'emergency-contact-status', maxPerMinute: 40, maxBodyBytes: 2_000 }, async (_req, user, body) => {
  await requirePremium(user.id);
  const attemptId = typeof body.attemptId === 'string' ? body.attemptId : '';
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return fail('Intento no válido.', 422, 'INVALID_ATTEMPT');

  const { data, error } = await admin.from('emergency_contact_attempts')
    .select('call_status,sms_status,acknowledged_at,created_at')
    .eq('id', attemptId).eq('user_id', user.id).maybeSingle();
  if (error) throw error;
  if (!data) return fail('Intento no encontrado.', 404, 'ATTEMPT_NOT_FOUND');

  return json({
    acknowledged: Boolean(data.acknowledged_at),
    acknowledgedAt: data.acknowledged_at,
    callStatus: data.call_status,
    smsStatus: data.sms_status,
    createdAt: data.created_at,
  });
}));