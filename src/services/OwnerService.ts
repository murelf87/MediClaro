import { supabase, dbError, requireUserId } from '../api';
export interface OwnerDashboard {
 generatedAt: string; days: number; page: number;
 kpis: Record<string, number>;
 billing: { provider: string; state: string; count: number }[];
 daily: { day: string; scans: number; chats: number; errors: number; cost: number }[];
 notifications: { state: string; count: number }[];
 activity: { action: string; created_at: string }[];
 accounts: { id: string; created_at: string; phone: string; plan: string; state: string; provider: string }[];
}
export interface PremiumGrant {
 phone: string; grantedAt: string; expiresAt: string | null; revokedAt: string | null;
 active: boolean; verified: boolean;
}
export const OwnerService = {
 async grants(page = 0): Promise<{ total: number; grants: PremiumGrant[] }> {
  await requireUserId();
  const { data, error } = await supabase.rpc('owner_premium_grants', { p_page: page });
  if (error) throw dbError(error);
  if (!data || !Array.isArray(data.grants)) throw new Error('Respuesta de accesos incompleta.');
  return data;
 },
 async setGrant(phone: string, enabled: boolean, days: number | null) {
  await requireUserId();
  const { data, error } = await supabase.rpc('owner_set_premium_grant', {
   p_phone: phone, p_enabled: enabled, p_days: days,
  });
  if (error) throw dbError(error);
  return data as { phone: string; enabled: boolean; verified: boolean };
 },
 async access(): Promise<boolean> {
  await requireUserId();
  const { data, error } = await supabase.rpc('owner_access');
  if (error) throw dbError(error);
  return data?.owner === true;
 },
 async dashboard(days: number, page: number): Promise<OwnerDashboard> {
  await requireUserId();
  const { data, error } = await supabase.rpc('owner_dashboard', { p_days: days, p_page: page });
  if (error) throw dbError(error);
  if (!data || !data.kpis || !Array.isArray(data.accounts)) throw new Error('Respuesta del panel incompleta.');
  return data as OwnerDashboard;
 },
};
