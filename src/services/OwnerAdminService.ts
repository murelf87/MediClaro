/**
 * Panel del propietario: habla con la función del servidor `owner_admin`
 * (migración 20261009170000_owner_admin_panel.sql). Las pantallas no conocen Supabase: solo usan este servicio.
 *
 * - Solo funciona con un teléfono de propietario verificado (lo comprueba el servidor en cada petición).
 * - El panel se abre con el código de 6 cifras o con Face ID y la sesión del panel vive SOLO en memoria: al cerrar la
 *   app hay que volver a abrirlo. El servidor la cierra tras 15 minutos sin actividad (8 h como máximo) y la app,
 *   además, al volver después de 2 minutos en segundo plano.
 * - Face ID: el permiso del dispositivo se guarda en el llavero del teléfono, protegido por Face ID / huella
 *   (expo-secure-store con requireAuthentication). En la web no existe.
 */
import { AppState, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { supabase } from '../lib/supabase';
import { requireUserId } from '../api';
import { AppError, toAppError } from '../api/errors';
import { AppNoticeService } from './AppNoticeService';

export type OwnerPlan = 'owner' | 'paid' | 'courtesy' | 'free';

export interface OwnerAccessStatus {
  hasPin: boolean;
  lockedUntil: string | null;
  attemptsLeft: number;
  devices: number;
  name: string | null;
  phone: string | null;
}

export type UnlockResult =
  | { ok: true }
  | { ok: false; error: 'PIN_INCORRECT' | 'LOCKED' | 'PIN_NOT_SET' | 'DEVICE_INVALID' | 'CANCELLED'; attemptsLeft?: number; lockedUntil?: string };

export interface OwnerUser {
  id: string;
  name: string | null;
  phone: string | null;
  verified: boolean;
  anonymous: boolean;
  plan: OwnerPlan;
  provider: string;
  subState: string;
  periodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  paidByFamily: boolean;
  courtesy: boolean;
  courtesyUntil: string | null;
  caregiver: boolean;
  caregiverLinks: number;
  patientLinks: number;
  createdAt: string;
  lastSignInAt: string | null;
}

export interface OwnerUserDetail {
  user: OwnerUser;
  store: { platform: string; productId: string; status: string; expiresAt: string | null; autoRenew: boolean | null } | null;
  lastBono: { id: string; name: string; grantedAt: string } | null;
  usage30d: { scans: number; chats: number; doses: number };
  lastActivityAt: string | null;
}

export interface OwnerOverview {
  owner: OwnerAccessStatus;
  counts: {
    users: number;
    newUsers7d: number;
    premium: number;
    paid: number;
    pastDue: number;
    courtesy: number;
    caregivers: number;
    bonosActive: number;
    activeIncidents: number;
    errors24h: number;
  };
  notice: { id: string; title: string | null; message: string; tone: string } | null;
  sessionExpiresAt: string | null;
}

export interface OwnerBono {
  id: string;
  name: string;
  /** null = vitalicio. */
  days: number | null;
  maxUses: number;
  uses: number;
  note: string | null;
  createdAt: string;
  disabledAt: string | null;
  state: 'active' | 'exhausted' | 'disabled';
}

export interface OwnerBonoUse {
  id: number;
  userId: string | null;
  name: string | null;
  phone: string | null;
  verified: boolean;
  createdAt: string;
  expiresAt: string | null;
  active: boolean;
}

export interface OwnerGrantResult {
  ok: true;
  phone: string | null;
  verified: boolean;
  expiresAt: string | null;
  lifetime: boolean;
  user: OwnerUser | null;
  bono: { id: string; name: string; uses: number; maxUses: number } | null;
}

export interface OwnerSubscriptionRow {
  userId: string | null;
  name: string | null;
  phone: string | null;
  kind: 'paid' | 'courtesy';
  provider: string;
  state: string;
  startsAt: string | null;
  endsAt: string | null;
  cancelAtPeriodEnd: boolean;
  paidByFamily: boolean;
}

export interface OwnerStatsBucket {
  bucket: string;
  doses: number;
  chats: number;
  emergencies: number;
  scans: number;
}

export interface OwnerStats {
  days: number;
  unit: 'day' | 'week' | 'month';
  since: string;
  generatedAt: string;
  kpis: {
    activeUsers: number;
    newUsers: number;
    doses: number;
    scans: number;
    chats: number;
    emergencies: number;
    careMessages: number;
    calls: number;
    bonosUsed: number;
    premiumActive: number;
    paidActive: number;
    users: number;
  };
  series: OwnerStatsBucket[];
}

export interface OwnerAuditRow {
  id: string;
  action: string;
  createdAt: string;
  actor: string | null;
  target: string | null;
  detail: Record<string, unknown>;
}

export interface OwnerNotice {
  id: string;
  enabled: boolean;
  title: string | null;
  message: string;
  tone: 'info' | 'warning' | 'success';
  until: string | null;
  updatedAt: string;
}

export interface OwnerSystem {
  serverTime: string;
  database: string;
  features: { medication: boolean; careChat: boolean; familyPay: boolean };
  queues: { key: string; label: string; pending: number; failed24h: number; delivered24h: number }[];
  cron: { name: string; schedule: string; active: boolean; lastStatus?: string | null; lastRunAt?: string | null }[];
  errors24h: number;
  aiCost24h: number;
  activeIncidents: number;
  storeVerification: boolean;
  notice: boolean;
}

export interface OwnerExport {
  kind: string;
  generatedAt: string;
  columns: string[];
  rows: unknown[][];
}

export interface OwnerAccount extends OwnerAccessStatus {
  pinUpdatedAt: string | null;
  sessions: number;
  recentUnlocks: { at: string; via: 'pin' | 'device' | 'setup' }[];
}

export interface OwnerDevice {
  id: string;
  label: string;
  createdAt: string;
  lastUsedAt: string | null;
  expiresAt: string;
  current: boolean;
}

export interface Paged<T> {
  total: number;
  page: number;
  pageSize: number;
  items: T[];
}

export const OWNER_NOT_DEPLOYED = 'OWNER_NOT_DEPLOYED';
export const OWNER_LOCKED = 'OWNER_LOCKED';

const SERVER_CODES: Record<string, { kind: AppError['kind']; message: string }> = {
  OWNER_REQUIRED: { kind: 'permission_denied', message: 'Este panel es solo para el propietario de MediClaro.' },
  OWNER_LOCKED: { kind: 'permission_denied', message: 'El panel se ha cerrado por seguridad. Vuelve a abrirlo con tu código.' },
  PIN_WEAK: { kind: 'invalid_input', message: 'Elige un código más difícil de adivinar: 6 cifras sin repetir ni seguir un orden (nada de 123456 o 111111).' },
  PIN_ALREADY_SET: { kind: 'conflict', message: 'Ya tienes un código creado. Abre el panel con él.' },
  PIN_SAME: { kind: 'invalid_input', message: 'El código nuevo tiene que ser distinto del actual.' },
  INVALID_PHONE: { kind: 'invalid_input', message: 'Revisa el teléfono: 9 cifras en España o el prefijo del país.' },
  USER_NO_PHONE: { kind: 'invalid_input', message: 'Esta persona aún no ha entrado con su teléfono. Dale el Premium por su número de teléfono: se activará cuando entre con él.' },
  BONO_EXHAUSTED: { kind: 'conflict', message: 'Este bono ya no tiene usos libres.' },
  BONO_DISABLED: { kind: 'conflict', message: 'Este bono está desactivado. Actívalo para usarlo.' },
  BONO_ALREADY_USED: { kind: 'conflict', message: 'Esta persona ya recibió este bono.' },
  INVALID_NAME: { kind: 'invalid_input', message: 'Ponle un nombre al bono (hasta 60 letras).' },
  INVALID_USES: { kind: 'invalid_input', message: 'El número de usos tiene que ser de 1 a 1000.' },
  INVALID_NOTICE: { kind: 'invalid_input', message: 'Revisa el aviso: título de hasta 60 letras, mensaje de 3 a 280 y fecha de fin dentro de los próximos 90 días.' },
  TOO_MANY_BONOS: { kind: 'limit_reached', message: 'Hay 200 bonos activos. Desactiva alguno antes de crear otro.' },
  NOT_FOUND: { kind: 'not_found', message: 'No lo hemos encontrado. Puede que ya no exista.' },
  RATE_LIMIT: { kind: 'rate_limited', message: 'Demasiadas peticiones seguidas. Espera un momento.' },
  INVALID_RANGE: { kind: 'invalid_input', message: 'Ese periodo no está disponible.' },
  INVALID_REQUEST: { kind: 'invalid_input', message: 'No se ha podido hacer. Revisa los datos e inténtalo de nuevo.' },
  INVALID_ACTION: { kind: 'invalid_input', message: 'Esta acción no existe en el servidor. Actualiza la app.' },
  AUTH_REQUIRED: { kind: 'unauthorized', message: '' },
};

export function ownerError(error: { message?: string; code?: string } | null | undefined): AppError {
  const message = String(error?.message ?? '');
  for (const [code, mapped] of Object.entries(SERVER_CODES)) {
    if (message.includes(code)) return new AppError(mapped.kind, mapped.message || undefined, { code });
  }
  if (error?.code === 'PGRST202' || error?.code === '42883' || /owner_admin/.test(message)) {
    return new AppError('not_configured', 'El panel todavía no está activado en el servidor de MediClaro (falta aplicar la migración del panel).', {
      code: OWNER_NOT_DEPLOYED,
    });
  }
  return toAppError(error ?? new Error('unknown'));
}

export function isOwnerLocked(e: unknown): boolean {
  return e instanceof AppError && e.code === OWNER_LOCKED;
}

// ── Sesión del panel (solo en memoria) ──────────────────────────────────────────────────────────────────
const IDLE_MS = 15 * 60 * 1000;
const BACKGROUND_LOCK_MS = 2 * 60 * 1000;
let panel: { token: string; expiresAt: number; userId: string } | null = null;
let version = 0;
let backgroundAt: number | null = null;
let watching = false;
const listeners = new Set<() => void>();

function emit(): void {
  version += 1;
  listeners.forEach((l) => l());
}

function setPanel(next: typeof panel): void {
  panel = next;
  emit();
}

function watchAppState(): void {
  if (watching) return;
  watching = true;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      if (panel && backgroundAt !== null && Date.now() - backgroundAt > BACKGROUND_LOCK_MS) void OwnerAdminService.lock();
      backgroundAt = null;
    } else if (state === 'background') {
      backgroundAt = Date.now();
    }
  });
}

async function rpc<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await supabase.rpc('owner_admin', { p_action: action, p_payload: payload });
  if (error) throw ownerError(error);
  return data as T;
}

/** Acciones con el panel abierto: añade la sesión, la alarga y, si el servidor la ha cerrado, la olvida. */
async function call<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const current = panel;
  if (!current || Date.now() >= current.expiresAt) {
    if (current) setPanel(null);
    throw new AppError('permission_denied', SERVER_CODES.OWNER_LOCKED.message, { code: OWNER_LOCKED });
  }
  try {
    const result = await rpc<T>(action, { ...payload, session: current.token });
    if (panel && panel.token === current.token) panel = { ...panel, expiresAt: Date.now() + IDLE_MS };
    return result;
  } catch (e) {
    if (isOwnerLocked(e) && panel?.token === current.token) setPanel(null);
    throw e;
  }
}

// ── Face ID (permiso del dispositivo en el llavero, protegido por biometría) ────────────────────────────
const deviceKey = (userId: string) => `mediclaro_owner_device_${userId.replace(/[^A-Za-z0-9._-]/g, '')}`;
const deviceFlagKey = (userId: string) => `${deviceKey(userId)}_on`;
const SECURE_OPTS: SecureStore.SecureStoreOptions = {
  requireAuthentication: true,
  authenticationPrompt: 'Abrir el panel de propietario de MediClaro',
  keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
};

export function deviceLabel(): string {
  const name = Platform.OS === 'ios' ? 'iPhone' : Platform.OS === 'android' ? 'Móvil Android' : 'Navegador';
  return `${name} · desde el ${new Date().toLocaleDateString('es-ES')}`;
}

async function storeDeviceToken(userId: string, token: string): Promise<boolean> {
  try {
    await SecureStore.setItemAsync(deviceKey(userId), token, SECURE_OPTS);
    await SecureStore.setItemAsync(deviceFlagKey(userId), '1');
    return true;
  } catch {
    return false;
  }
}

async function forgetDeviceToken(userId: string): Promise<void> {
  await SecureStore.deleteItemAsync(deviceKey(userId), SECURE_OPTS).catch(() => undefined);
  await SecureStore.deleteItemAsync(deviceFlagKey(userId)).catch(() => undefined);
}

type SessionReply = { ok: true; session: string; expiresAt: string; deviceToken?: string; deviceId?: string };
type FailReply = { ok: false; error: 'PIN_INCORRECT' | 'LOCKED' | 'PIN_NOT_SET' | 'DEVICE_INVALID'; attemptsLeft?: number; lockedUntil?: string };

async function openWith(userId: string, reply: SessionReply | FailReply, trustDevice: boolean): Promise<UnlockResult & { faceIdSaved?: boolean }> {
  if (!reply.ok) return reply;
  setPanel({ token: reply.session, expiresAt: Date.now() + IDLE_MS, userId });
  watchAppState();
  let faceIdSaved: boolean | undefined;
  if (trustDevice && reply.deviceToken) {
    faceIdSaved = await storeDeviceToken(userId, reply.deviceToken);
    // Si el teléfono no ha guardado el permiso (Face ID cancelado), se retira también en el servidor.
    if (!faceIdSaved && reply.deviceId) await call('device_revoke', { deviceId: reply.deviceId }).catch(() => undefined);
  }
  return { ok: true, faceIdSaved };
}

export const OwnerAdminService = {
  // ── Estado del panel en la app ──
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  snapshot(): number {
    return version;
  },
  isUnlocked(): boolean {
    return !!panel && Date.now() < panel.expiresAt;
  },
  /** Al cerrar sesión o borrar la cuenta. */
  clear(): void {
    if (panel) setPanel(null);
  },

  // ── Abrir y cerrar ──
  status: (): Promise<OwnerAccessStatus> => rpc<OwnerAccessStatus>('status'),

  async setupPin(pin: string, trustDevice: boolean): Promise<UnlockResult & { faceIdSaved?: boolean }> {
    const userId = await requireUserId();
    const reply = await rpc<SessionReply>('setup_pin', { pin, trustDevice, deviceLabel: deviceLabel() });
    return openWith(userId, reply, trustDevice);
  },

  async unlock(pin: string, trustDevice = false): Promise<UnlockResult & { faceIdSaved?: boolean }> {
    const userId = await requireUserId();
    const reply = await rpc<SessionReply | FailReply>('unlock', { pin, trustDevice, deviceLabel: deviceLabel() });
    return openWith(userId, reply, trustDevice);
  },

  /** ¿Se puede usar Face ID / huella en este teléfono? */
  canUseFaceId(): boolean {
    if (Platform.OS === 'web') return false;
    try {
      return SecureStore.canUseBiometricAuthentication();
    } catch {
      return false;
    }
  },

  /** ¿Hay un permiso de Face ID guardado en este teléfono? (sin pedir Face ID). */
  async hasFaceId(): Promise<boolean> {
    if (!OwnerAdminService.canUseFaceId()) return false;
    const userId = await requireUserId().catch(() => null);
    if (!userId) return false;
    return (await SecureStore.getItemAsync(deviceFlagKey(userId)).catch(() => null)) === '1';
  },

  async unlockWithFaceId(): Promise<UnlockResult> {
    const userId = await requireUserId();
    let token: string | null = null;
    try {
      token = await SecureStore.getItemAsync(deviceKey(userId), SECURE_OPTS);
    } catch {
      return { ok: false, error: 'CANCELLED' };
    }
    if (!token) {
      await forgetDeviceToken(userId);
      return { ok: false, error: 'DEVICE_INVALID' };
    }
    const reply = await rpc<SessionReply | FailReply>('unlock_device', { deviceToken: token });
    if (!reply.ok) {
      if (reply.error === 'DEVICE_INVALID') await forgetDeviceToken(userId);
      return reply;
    }
    return openWith(userId, reply, false);
  },

  /** Activa Face ID en este teléfono con el panel abierto (pide otra vez el código). */
  async enableFaceId(pin: string): Promise<UnlockResult & { faceIdSaved?: boolean }> {
    const userId = await requireUserId();
    const reply = await call<{ ok: true; deviceToken: string; deviceId: string } | FailReply>('trust_device', { pin, deviceLabel: deviceLabel() });
    if (!reply.ok) return reply;
    const saved = await storeDeviceToken(userId, reply.deviceToken);
    if (!saved) await call('device_revoke', { deviceId: reply.deviceId }).catch(() => undefined);
    return { ok: true, faceIdSaved: saved };
  },

  async disableFaceIdHere(): Promise<void> {
    const userId = await requireUserId();
    await forgetDeviceToken(userId);
  },

  async lock(): Promise<void> {
    const current = panel;
    if (!current) return;
    setPanel(null);
    await rpc('lock', { session: current.token }).catch(() => undefined);
  },

  // ── Datos ──
  overview: () => call<OwnerOverview>('overview'),

  async users(opts: { tab?: 'all' | 'patients' | 'caregivers'; q?: string; page?: number } = {}): Promise<Paged<OwnerUser>> {
    const r = await call<{ total: number; page: number; pageSize: number; users: OwnerUser[] }>('users', {
      tab: opts.tab ?? 'all',
      q: (opts.q ?? '').trim().slice(0, 60),
      page: opts.page ?? 0,
    });
    return { total: r.total, page: r.page, pageSize: r.pageSize, items: r.users ?? [] };
  },
  user: (userId: string) => call<OwnerUserDetail>('user', { userId }),

  /** Premium de cortesía: a una cuenta (userId) o a un teléfono; con un bono o por días (null = vitalicio). */
  grant: (target: { userId?: string; phone?: string }, how: { bonoId: string } | { days: number | null }) =>
    call<OwnerGrantResult>('grant', { ...target, ...how }),
  revoke: (target: { userId?: string; phone?: string }) => call<{ ok: true; changed: boolean; phone: string | null }>('revoke', target),

  async bonos(opts: { state?: 'all' | 'active' | 'finished'; page?: number } = {}): Promise<Paged<OwnerBono> & { activeCount: number; usesLeft: number }> {
    const r = await call<{ total: number; page: number; pageSize: number; bonos: OwnerBono[]; activeCount: number; usesLeft: number }>('bonos', {
      state: opts.state ?? 'all',
      page: opts.page ?? 0,
    });
    return { total: r.total, page: r.page, pageSize: r.pageSize, items: r.bonos ?? [], activeCount: r.activeCount, usesLeft: r.usesLeft };
  },
  bonoCreate: (bono: { name: string; days: number | null; maxUses: number; note?: string }) => call<OwnerBono>('bono_create', bono),
  bono: (bonoId: string) => call<{ bono: OwnerBono; uses: OwnerBonoUse[] }>('bono', { bonoId }),
  bonoDisable: (bonoId: string) => call<OwnerBono>('bono_disable', { bonoId }),
  bonoEnable: (bonoId: string) => call<OwnerBono>('bono_enable', { bonoId }),

  async subscriptions(opts: { tab?: 'active' | 'history'; page?: number } = {}): Promise<
    Paged<OwnerSubscriptionRow> & { totals: { paid: number; trial: number; pastDue: number; cancelling: number; courtesy: number } }
  > {
    const r = await call<{
      total: number;
      page: number;
      pageSize: number;
      rows: OwnerSubscriptionRow[];
      totals: { paid: number; trial: number; pastDue: number; cancelling: number; courtesy: number };
    }>('subscriptions', { tab: opts.tab ?? 'active', page: opts.page ?? 0 });
    return { total: r.total, page: r.page, pageSize: r.pageSize, items: r.rows ?? [], totals: r.totals };
  },
  stats: (days: 7 | 30 | 90 | 365) => call<OwnerStats>('stats', { days }),
  audit: (tab: 'activity' | 'events', page = 0) =>
    call<{ tab: string; page: number; pageSize: number; rows: OwnerAuditRow[] }>('audit', { tab, page }),
  async notice(): Promise<OwnerNotice | null> {
    const r = await call<{ notice: OwnerNotice | null }>('notice_get');
    return r.notice ?? null;
  },
  async setNotice(n: { enabled: boolean; title?: string; message: string; tone: OwnerNotice['tone']; until?: string | null }): Promise<OwnerNotice> {
    const r = await call<{ notice: OwnerNotice }>('notice_set', { ...n, until: n.until ?? null });
    AppNoticeService.clearCache(); // el propietario lo ve en Inicio al momento
    return r.notice;
  },
  system: () => call<OwnerSystem>('system'),
  exportData: (kind: 'users' | 'subscriptions' | 'bonos' | 'audit') => call<OwnerExport>('export', { kind }),
  account: () => call<OwnerAccount>('account'),
  async devices(): Promise<OwnerDevice[]> {
    const r = await call<{ devices: OwnerDevice[] }>('devices');
    return r.devices ?? [];
  },
  deviceRevoke: (deviceId: string) => call<{ ok: true }>('device_revoke', { deviceId }),
  changePin: (currentPin: string, newPin: string) => call<UnlockResult>('change_pin', { currentPin, newPin }),
};

/** CSV para Excel/Números (separador «;», comillas y BOM para los acentos). */
export function toCsv(data: OwnerExport): string {
  const cell = (v: unknown) => {
    const s = v === null || v === undefined ? '' : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [data.columns.map(cell).join(';'), ...data.rows.map((r) => r.map(cell).join(';'))];
  return `﻿${lines.join('\r\n')}\r\n`;
}
