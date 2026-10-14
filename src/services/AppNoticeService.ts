/**
 * Aviso general de MediClaro (lo escribe el propietario desde su panel; p. ej. un mantenimiento).
 * Lo lee cualquier persona con `app_notice()` (migración 20261009170000_owner_admin_panel.sql). Si el servidor aún no
 * tiene esa función o no hay conexión, simplemente no hay aviso. Cada persona puede cerrarlo en su teléfono.
 */
import { supabase } from '../lib/supabase';
import { localStore } from '../api/storage';

export interface AppNotice {
  id: string;
  title: string | null;
  message: string;
  tone: 'info' | 'warning' | 'success';
  until: string | null;
}

const DISMISSED_KEY = 'mediclaro_app_notice_dismissed';
const MAX_AGE_MS = 5 * 60 * 1000;
let cache: { at: number; value: AppNotice | null } | null = null;

export function parseNotice(v: unknown): AppNotice | null {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const o = v as Record<string, unknown>;
  const id = typeof o.id === 'string' ? o.id : '';
  const message = typeof o.message === 'string' ? o.message.trim() : '';
  if (!id || !message) return null;
  const until = typeof o.until === 'string' && o.until ? o.until : null;
  if (until && Date.parse(until) <= Date.now()) return null;
  return {
    id,
    title: typeof o.title === 'string' && o.title.trim() ? o.title.trim() : null,
    message,
    tone: o.tone === 'warning' || o.tone === 'success' ? o.tone : 'info',
    until,
  };
}

export const AppNoticeService = {
  /** El aviso activo (o null). Se guarda 5 minutos para no preguntar en cada pantalla. */
  async current(maxAgeMs = MAX_AGE_MS): Promise<AppNotice | null> {
    if (cache && Date.now() - cache.at < maxAgeMs) return cache.value && parseNotice(cache.value);
    try {
      const { data, error } = await supabase.rpc('app_notice');
      if (error) return cache?.value ?? null;
      const value = parseNotice(data);
      cache = { at: Date.now(), value };
      return value;
    } catch {
      return cache?.value ?? null;
    }
  },
  /** Aviso que la persona aún no ha cerrado en este teléfono. */
  async visible(maxAgeMs = MAX_AGE_MS): Promise<AppNotice | null> {
    const notice = await AppNoticeService.current(maxAgeMs);
    if (!notice) return null;
    const dismissed = await localStore.getJSON<string[]>(DISMISSED_KEY, []);
    return dismissed.includes(notice.id) ? null : notice;
  },
  async dismiss(id: string): Promise<void> {
    const dismissed = await localStore.getJSON<string[]>(DISMISSED_KEY, []);
    await localStore.setJSON(DISMISSED_KEY, [id, ...dismissed.filter((x) => x !== id)].slice(0, 20));
  },
  clearCache(): void {
    cache = null;
  },
};
