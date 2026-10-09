/**
 * Formatos y textos del panel del propietario (sin React: se prueban en __tests__/ownerFormat.test.ts).
 */
import type { IconName } from '../../components/Icon';
import type { OwnerAuditRow, OwnerPlan, OwnerUser } from '../../services/OwnerAdminService';

export type TileColor = 'blue' | 'green' | 'purple' | 'amber' | 'red' | 'teal';

// ── Planes y cobros ──
export const PROVIDER_LABEL: Record<string, string> = {
  stripe: 'Tarjeta',
  bizum: 'Bizum',
  apple: 'App Store',
  google: 'Google Play',
  courtesy: 'Cortesía',
};

export const SUB_STATE_LABEL: Record<string, string> = {
  ACTIVE: 'Activa',
  TRIAL: 'En prueba',
  PAST_DUE: 'Pago pendiente',
  CANCELLED: 'Cancelada',
  EXPIRED: 'Caducada',
  REVOKED: 'Retirada',
  FREE: 'Sin Premium',
};

export function planText(user: Pick<OwnerUser, 'plan' | 'provider'>): string {
  switch (user.plan) {
    case 'owner':
      return 'Propietario';
    case 'paid':
      return `Premium · ${PROVIDER_LABEL[user.provider] ?? 'Pago'}`;
    case 'courtesy':
      return 'Premium de cortesía';
    default:
      return 'Básico';
  }
}

// ── Formatos ─────────────────────────────────────────────────────────────────────────────────────────────
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} · ${d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
}

export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/** 7 → «7 días», 30 → «30 días», 90 → «3 meses», 365 → «1 año», null → «Vitalicio». */
export function fmtDays(days: number | null): string {
  if (days === null) return 'Vitalicio';
  if (days === 365) return '1 año';
  if (days % 365 === 0) return `${days / 365} años`;
  if (days === 90) return '3 meses';
  if (days === 180) return '6 meses';
  return days === 1 ? '1 día' : `${days} días`;
}

export const DURATIONS: { days: number | null; label: string }[] = [
  { days: 7, label: '7 días' },
  { days: 30, label: '30 días' },
  { days: 90, label: '3 meses' },
  { days: 365, label: '1 año' },
  { days: null, label: 'Vitalicio' },
];


// ── Bonos ──
/**
 * Tipo de bono, como en el diseño: «Premium completo» (para una persona, o varias sueltas) o «Premium familiar» (el
 * mismo Premium para varias personas de una familia). MediClaro tiene un solo Premium: el tipo solo describe a quién va
 * dirigido el bono y se guarda en su nombre («Bono familiar …»), que pone la app al crearlo.
 */
export type BonoKind = 'full' | 'family';

export function bonoKind(name: string | null | undefined): BonoKind {
  return /^bono familiar\b/i.test((name ?? '').trim()) ? 'family' : 'full';
}

export const BONO_KIND_LABEL: Record<BonoKind, string> = { full: 'Premium completo', family: 'Premium familiar' };

/** «Premium completo · 30 días», «Premium familiar · 90 días» o, si el nombre ya dice «vitalicio», solo el tipo. */
export function bonoSubtitle(b: { name: string; days: number | null }): string {
  const kind = BONO_KIND_LABEL[bonoKind(b.name)];
  if (b.days === null && /vitalicio/i.test(b.name)) return kind;
  return `${kind} · ${bonoDays(b.days)}`;
}

/** Duración de un bono con las palabras del diseño: «7 días», «90 días», «1 año», «Vitalicio». */
export function bonoDays(days: number | null): string {
  if (days === null) return 'Vitalicio';
  if (days % 365 === 0) return days === 365 ? '1 año' : `${days / 365} años`;
  return days === 1 ? '1 día' : `${days} días`;
}

/** Nombre automático del bono, como en el diseño: «Bono 30 días», «Bono familiar 90 días», «Bono vitalicio»… */
export function autoBonoName(kind: BonoKind, days: number | null): string {
  const d = days === null ? 'vitalicio' : bonoDays(days);
  return kind === 'family' ? `Bono familiar ${d}` : `Bono ${d}`;
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['do', 'lu', 'ma', 'mi', 'ju', 'vi', 'sá'];

/** Etiqueta del eje del gráfico: «lu 6» (días), «6 oct» (semanas) u «oct» (meses). */
export function bucketLabel(bucket: string, unit: 'day' | 'week' | 'month'): string {
  const [y, m, d] = bucket.split('-').map(Number);
  const date = new Date(y, (m || 1) - 1, d || 1);
  if (unit === 'month') return MONTHS[date.getMonth()];
  if (unit === 'day') return `${WEEKDAYS[date.getDay()]} ${date.getDate()}`;
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

const EXPORT_KIND: Record<string, string> ={ users: 'usuarios', subscriptions: 'suscripciones', bonos: 'bonos', audit: 'registro' };

/** Título, detalle e icono de cada anotación del registro. */
export function describeAudit(row: OwnerAuditRow): { icon: IconName; color: TileColor; title: string; detail: string } {
  const d = row.detail ?? {};
  const str = (k: string) => (typeof d[k] === 'string' ? (d[k] as string) : null);
  const num = (k: string) => (typeof d[k] === 'number' ? (d[k] as number) : null);
  const target = row.target ?? null;
  switch (row.action) {
    case 'owner_pin_created':
      return { icon: 'key-outline', color: 'blue', title: 'Código del panel creado', detail: 'Propietario' };
    case 'owner_unlocked':
      return { icon: 'lock-open-outline', color: 'blue', title: 'Acceso al dashboard', detail: `Propietario · ${str('via') === 'device' ? 'con Face ID' : 'con código'}` };
    case 'owner_locked':
      return { icon: 'lock-closed', color: 'red', title: 'Panel bloqueado por intentos fallidos', detail: '15 minutos sin poder entrar' };
    case 'owner_pin_changed':
      return { icon: 'key-outline', color: 'amber', title: 'Código del panel cambiado', detail: 'Se cerraron los demás accesos y Face ID' };
    case 'owner_device_added':
      return { icon: 'scan-outline', color: 'blue', title: 'Face ID activado en un teléfono', detail: row.actor ?? '' };
    case 'owner_device_removed':
      return { icon: 'scan-outline', color: 'amber', title: 'Teléfono con Face ID quitado', detail: row.actor ?? '' };
    case 'owner_bono_created': {
      // Como en el diseño: «30 días · Premium completo» (el nombre del bono se ve al tocar la fila).
      const uses = num('max_uses');
      return {
        icon: 'gift-outline',
        color: 'amber',
        title: 'Bono generado',
        detail: [bonoDays(d.lifetime === true ? null : num('days')), BONO_KIND_LABEL[bonoKind(str('bono_name'))], uses && uses > 1 ? `${uses} personas` : null]
          .filter(Boolean)
          .join(' · '),
      };
    }
    case 'owner_bono_disabled':
      return { icon: 'pause-circle-outline', color: 'amber', title: 'Bono desactivado', detail: str('bono_name') ?? '' };
    case 'owner_bono_enabled':
      return { icon: 'play-circle-outline', color: 'green', title: 'Bono activado', detail: str('bono_name') ?? '' };
    case 'courtesy_premium_granted':
      // Como en el diseño: solo a quién (el bono y la fecha de fin se ven al tocar la fila).
      return { icon: 'diamond-outline', color: 'purple', title: 'Premium concedido', detail: target ?? 'Teléfono sin cuenta' };
    case 'courtesy_premium_revoked':
      return { icon: 'close-circle-outline', color: 'red', title: 'Premium retirado', detail: target ?? 'Teléfono sin cuenta' };
    case 'owner_user_viewed':
      return { icon: 'eye-outline', color: 'teal', title: 'Ficha consultada', detail: target ?? 'Cuenta eliminada' };
    case 'owner_notice_updated':
      return { icon: 'megaphone-outline', color: 'blue', title: 'Aviso de la app cambiado', detail: d.enabled === true ? 'Aviso visible para todos' : 'Aviso apagado' };
    case 'owner_export':
      return { icon: 'download-outline', color: 'teal', title: 'Copia descargada', detail: `${EXPORT_KIND[str('kind') ?? ''] ?? str('kind') ?? ''} · ${num('rows') ?? 0} filas` };
    case 'user_registered':
      return { icon: 'person-add-outline', color: 'green', title: 'Usuario registrado', detail: row.actor ?? 'Sin nombre' };
    case 'account_deleted':
      return { icon: 'trash-outline', color: 'red', title: 'Cuenta eliminada', detail: 'La persona borró su cuenta' };
    case 'data_exported':
      return { icon: 'download-outline', color: 'blue', title: 'Una persona descargó sus datos', detail: row.actor ?? '' };
    case 'subscription_changed':
      return { icon: 'card-outline', color: 'purple', title: 'Suscripción cambiada', detail: row.actor ?? '' };
    case 'admin_config_changed':
      return { icon: 'settings-outline', color: 'teal', title: 'Configuración cambiada', detail: '' };
    default:
      return { icon: 'ellipse-outline', color: 'blue', title: row.action.replace(/_/g, ' '), detail: row.actor ?? '' };
  }
}

const VIA_LABEL: Record<string, string> = { pin: 'Con código', device: 'Con Face ID', panel: 'Desde el panel', setup: 'Al crear el código' };
const TONE_LABEL: Record<string, string> = { info: 'Información', warning: 'Importante', success: 'Buena noticia' };

/** Todos los datos de una anotación del registro (al tocarla), con nombres en español y sin datos de más. */
export function auditFacts(row: OwnerAuditRow): { label: string; value: string }[] {
  const d = row.detail ?? {};
  const out: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) out.push({ label, value });
  };
  const ownerAction = row.action.startsWith('owner_') || row.action.startsWith('courtesy_');
  add('Fecha', fmtDateTime(row.createdAt));
  add('Quién', row.actor ?? (ownerAction ? 'Propietario' : 'Sin nombre'));
  add('Sobre', row.target);
  if (typeof d.bono_name === 'string') add('Bono', d.bono_name);
  if (d.lifetime === true) add('Duración', 'Vitalicio');
  else if (typeof d.days === 'number') add('Duración', bonoDays(d.days));
  if (typeof d.max_uses === 'number') add('Personas', String(d.max_uses));
  if (typeof d.expires_at === 'string') add('Premium hasta', fmtDate(d.expires_at));
  if (typeof d.via === 'string') add('Cómo', VIA_LABEL[d.via] ?? d.via);
  if (typeof d.label === 'string') add('Teléfono', d.label);
  if (typeof d.enabled === 'boolean') add('Aviso', d.enabled ? 'Visible para todos' : 'Apagado');
  if (typeof d.tone === 'string') add('Tipo', TONE_LABEL[d.tone] ?? d.tone);
  if (typeof d.until === 'string') add('Hasta', fmtDateTime(d.until));
  if (typeof d.kind === 'string') add('Datos', EXPORT_KIND[d.kind] ?? d.kind);
  if (typeof d.rows === 'number') add('Filas', d.rows.toLocaleString('es-ES'));
  if (typeof d.minutes === 'number') add('Bloqueo', `${d.minutes} minutos`);
  return out;
}

/** Para comprobar que un plan existe (respuestas raras del servidor). */
export function isPlan(v: unknown): v is OwnerPlan {
  return v === 'owner' || v === 'paid' || v === 'courtesy' || v === 'free';
}
