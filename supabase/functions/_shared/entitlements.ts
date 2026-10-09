import { admin, HttpError } from './common.ts';

export type Entitlement = {
  plan: string;
  subState: string;
  billingProvider: string;
  country: string;
};

const ACTIVE = new Set(['ACTIVE', 'TRIAL', 'PAST_DUE']);

export async function entitlementFor(userId: string): Promise<Entitlement> {
  const owner = await admin.rpc('owner_access_for_service', { p_user: userId });
  if (owner.error) throw owner.error;
  if (owner.data === true) return { plan: 'premium', subState: 'ACTIVE', billingProvider: 'owner', country: 'ES' };
  const courtesy = await admin.rpc('courtesy_access_for_service', { p_user: userId });
  if (courtesy.error) throw courtesy.error;
  if (courtesy.data === true) return { plan: 'premium', subState: 'ACTIVE', billingProvider: 'courtesy', country: 'ES' };
  const { data, error } = await admin.from('profiles')
    .select('plan, sub_state, billing_provider, country')
    .eq('id', userId).maybeSingle();
  if (error) throw error;
  return {
    plan: data?.plan ?? 'free',
    subState: data?.sub_state ?? 'FREE',
    billingProvider: data?.billing_provider ?? 'stripe',
    country: String(data?.country ?? 'ES').toUpperCase(),
  };
}

/** La autorización real de IA vive en servidor; la UI no puede saltársela. */
export async function requirePremium(userId: string): Promise<Entitlement> {
  const ent = await entitlementFor(userId);
  if (ent.plan !== 'premium' || !ACTIVE.has(ent.subState)) {
    throw new HttpError(402, 'PREMIUM_REQUIRED', 'Esta función requiere MediClaro Premium.');
  }
  return ent;
}
