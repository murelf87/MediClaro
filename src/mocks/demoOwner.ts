/**
 * MODO DEMOSTRACIÓN — Panel del propietario simulado en memoria (escenario «propietario» de la vista previa).
 * Mismas respuestas y errores que `owner_admin` (migración 20261009170000_owner_admin_panel.sql). Las personas, bonos y
 * cifras son INVENTADOS y solo existen aquí (nunca en producción).
 */
type Result = { data: unknown; error: unknown };
type Row = Record<string, unknown>;

interface DemoUser {
  id: string;
  name: string | null;
  phone: string | null;
  anonymous: boolean;
  paid: { provider: 'stripe' | 'apple' | 'google' | 'bizum'; state: 'ACTIVE' | 'TRIAL' | 'PAST_DUE' | 'CANCELLED' | 'EXPIRED'; start: number; end: number; cancelling?: boolean; family?: boolean } | null;
  caregiverOf: number;
  caregivers: number;
  createdDaysAgo: number;
}

interface DemoGrant {
  phone: string;
  grantedAt: number;
  expiresAt: number | null;
  revokedAt: number | null;
}

interface DemoBono {
  id: string;
  name: string;
  days: number | null;
  maxUses: number;
  uses: number;
  note: string | null;
  createdAt: number;
  disabledAt: number | null;
}

const DAY = 86_400_000;
const iso = (t: number | null) => (t === null ? null : new Date(t).toISOString());
const rid = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 16).toString(16)).join('');
const uuid = () => `${rid(8)}-${rid(4)}-4${rid(3)}-a${rid(3)}-${rid(12)}`;
const mask = (p: string | null) => (p ? `+${p.slice(0, Math.max(1, p.length - 9))} ••• ••• ${p.slice(-3)}` : null);
const normalizePhone = (p: string): string | null => {
  if (!/^[+0-9 ()-]{1,32}$/.test(p)) return null;
  let n = p.replace(/\D/g, '');
  if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 9) n = `34${n}`;
  return /^[1-9][0-9]{7,14}$/.test(n) ? n : null;
};
const WEAK = new Set(['012345', '123456', '234567', '345678', '456789', '987654', '876543', '765432', '654321', '543210', '121212', '112233', '123123', '123321', '111222', '101010', '202020', '159753', '147258', '000111']);
const weakPin = (p: unknown) => typeof p !== 'string' || !/^[0-9]{6}$/.test(p) || /^(.)\1{5}$/.test(p) || WEAK.has(p);
const fail = (code: string): Result => ({ data: null, error: { message: code } });
const ok = (data: unknown): Result => ({ data, error: null });

export function createDemoOwner(opts: { ownerId: string; ownerName: () => string; ownerPhone: string; now?: () => number }) {
  const now = opts.now ?? (() => Date.now());
  const t0 = now();
  const ownerUser: DemoUser = { id: opts.ownerId, name: null, phone: opts.ownerPhone.replace(/\D/g, ''), anonymous: false, paid: null, caregiverOf: 0, caregivers: 0, createdDaysAgo: 120 };
  // La otra propietaria (Marina): en el servidor real los dos teléfonos de propietario ya están dados de alta.
  const coOwner: DemoUser = { id: uuid(), name: 'Marina', phone: '34646350527', anonymous: false, paid: null, caregiverOf: 0, caregivers: 0, createdDaysAgo: 120 };
  const users: DemoUser[] = [
    ownerUser,
    coOwner,
    { id: uuid(), name: 'Carmen García', phone: '34612345678', anonymous: false, paid: { provider: 'apple', state: 'ACTIVE', start: t0 - 20 * DAY, end: t0 + 345 * DAY }, caregiverOf: 0, caregivers: 1, createdDaysAgo: 40 },
    { id: uuid(), name: 'Luis Martínez', phone: '34611234567', anonymous: false, paid: null, caregiverOf: 0, caregivers: 0, createdDaysAgo: 33 },
    { id: uuid(), name: 'Ana López', phone: '34633987654', anonymous: false, paid: null, caregiverOf: 0, caregivers: 2, createdDaysAgo: 28 },
    { id: uuid(), name: 'María Torres', phone: '34600112233', anonymous: false, paid: null, caregiverOf: 1, caregivers: 0, createdDaysAgo: 27 },
    { id: uuid(), name: 'José Ruiz', phone: '34655443322', anonymous: false, paid: { provider: 'stripe', state: 'PAST_DUE', start: t0 - 35 * DAY, end: t0 - 2 * DAY }, caregiverOf: 0, caregivers: 0, createdDaysAgo: 60 },
    { id: uuid(), name: 'Elena Gómez', phone: '34688776655', anonymous: false, paid: { provider: 'bizum', state: 'ACTIVE', start: t0 - 10 * DAY, end: t0 + 80 * DAY }, caregiverOf: 0, caregivers: 1, createdDaysAgo: 15 },
    { id: uuid(), name: 'Rosa Díaz', phone: '34677889900', anonymous: false, paid: { provider: 'google', state: 'ACTIVE', start: t0 - 5 * DAY, end: t0 + 25 * DAY, family: true }, caregiverOf: 0, caregivers: 1, createdDaysAgo: 9 },
    { id: uuid(), name: 'Pedro Sánchez', phone: null, anonymous: true, paid: null, caregiverOf: 0, caregivers: 0, createdDaysAgo: 4 },
    { id: uuid(), name: 'Javier Martín', phone: '34644332211', anonymous: false, paid: null, caregiverOf: 1, caregivers: 0, createdDaysAgo: 3 },
    { id: uuid(), name: 'Lucía Fernández', phone: '34699001122', anonymous: false, paid: { provider: 'stripe', state: 'ACTIVE', start: t0 - 300 * DAY, end: t0 + 65 * DAY, cancelling: true }, caregiverOf: 0, caregivers: 0, createdDaysAgo: 300 },
    { id: uuid(), name: 'Antonio Pérez', phone: '34622110099', anonymous: false, paid: { provider: 'apple', state: 'EXPIRED', start: t0 - 90 * DAY, end: t0 - 30 * DAY }, caregiverOf: 0, caregivers: 0, createdDaysAgo: 95 },
  ];
  const byName = (n: string) => users.find((u) => u.name === n) as DemoUser;
  const grants = new Map<string, DemoGrant>();
  const bonos: DemoBono[] = [
    { id: uuid(), name: 'Bono 30 días', days: 30, maxUses: 5, uses: 2, note: null, createdAt: t0 - 12 * DAY, disabledAt: null },
    { id: uuid(), name: 'Bono familiar', days: 90, maxUses: 3, uses: 1, note: 'Familia de Ana', createdAt: t0 - 9 * DAY, disabledAt: null },
    { id: uuid(), name: 'Bono vitalicio', days: null, maxUses: 1, uses: 0, note: null, createdAt: t0 - 2 * DAY, disabledAt: null },
  ];
  const bonoUses: { id: number; bonoId: string; phone: string; createdAt: number; expiresAt: number | null }[] = [];
  let useSeq = 1;
  const seedGrant = (u: DemoUser, bono: DemoBono, daysAgo: number) => {
    const at = t0 - daysAgo * DAY;
    const exp = bono.days === null ? null : at + bono.days * DAY;
    grants.set(u.phone as string, { phone: u.phone as string, grantedAt: at, expiresAt: exp, revokedAt: null });
    bonoUses.push({ id: useSeq++, bonoId: bono.id, phone: u.phone as string, createdAt: at, expiresAt: exp });
  };
  seedGrant(byName('Ana López'), bonos[1], 8);
  seedGrant(byName('María Torres'), bonos[0], 10);
  seedGrant(byName('Javier Martín'), bonos[0], 3);
  grants.set('34655001122', { phone: '34655001122', grantedAt: t0 - DAY, expiresAt: t0 + 29 * DAY, revokedAt: null });
  bonoUses.push({ id: useSeq++, bonoId: bonos[0].id, phone: '34655001122', createdAt: t0 - DAY, expiresAt: t0 + 29 * DAY });
  bonos[0].uses = 3;

  const audit: { id: number; action: string; at: number; actor: string | null; target: string | null; detail: Row }[] = [];
  let auditSeq = 1;
  const log = (action: string, target: string | null = null, detail: Row = {}, at = now()) =>
    audit.push({ id: auditSeq++, action, at, actor: opts.ownerName(), target, detail });
  log('owner_bono_created', null, { bono_name: 'Bono 30 días', days: 30, lifetime: false, max_uses: 5 }, t0 - 12 * DAY);
  log('courtesy_premium_granted', 'María Torres', { bono_name: 'Bono 30 días', expires_at: iso(t0 + 20 * DAY), lifetime: false }, t0 - 10 * DAY);
  log('owner_bono_created', null, { bono_name: 'Bono familiar', days: 90, lifetime: false, max_uses: 3 }, t0 - 9 * DAY);
  log('courtesy_premium_granted', 'Ana López', { bono_name: 'Bono familiar', expires_at: iso(t0 + 82 * DAY), lifetime: false }, t0 - 8 * DAY);
  log('courtesy_premium_granted', 'Javier Martín', { bono_name: 'Bono 30 días', expires_at: iso(t0 + 27 * DAY), lifetime: false }, t0 - 3 * DAY);
  log('owner_bono_created', null, { bono_name: 'Bono vitalicio', days: null, lifetime: true, max_uses: 1 }, t0 - 2 * DAY);
  const events: { id: string; action: string; at: number; actor: string | null }[] = users
    .filter((u) => u !== ownerUser)
    .map((u) => ({ id: `u${u.id}`, action: 'user_registered', at: t0 - u.createdDaysAgo * DAY, actor: u.name }));
  events.push({ id: 'e1', action: 'data_exported', at: t0 - 6 * DAY, actor: 'Carmen García' });

  let pin: string | null = null;
  let failed = 0;
  let lockedUntil: number | null = null;
  let pinUpdatedAt: number | null = null;
  const sessions = new Map<string, { expiresAt: number; createdAt: number; via: string }>();
  const unlocks: { at: number; via: string }[] = [];
  let notice: Row | null = null;

  const courtesy = (u: DemoUser) => {
    const g = u.phone ? grants.get(u.phone) : undefined;
    return g && g.revokedAt === null && (g.expiresAt === null || g.expiresAt > now()) ? g : null;
  };
  const planOf = (u: DemoUser) =>
    u === ownerUser || u === coOwner ? 'owner' : u.paid && ['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(u.paid.state) ? 'paid' : courtesy(u) ? 'courtesy' : 'free';
  const userJson = (u: DemoUser): Row => {
    const g = courtesy(u);
    return {
      id: u.id,
      name: u === ownerUser ? opts.ownerName() : u.name,
      phone: u.anonymous ? null : mask(u.phone),
      verified: !u.anonymous && !!u.phone,
      anonymous: u.anonymous,
      plan: planOf(u),
      provider: u.paid?.provider ?? 'stripe',
      subState: u.paid?.state ?? 'FREE',
      periodEnd: iso(u.paid?.end ?? null),
      cancelAtPeriodEnd: !!u.paid?.cancelling,
      paidByFamily: !!u.paid?.family,
      courtesy: !!g,
      courtesyUntil: g ? iso(g.expiresAt) : null,
      caregiver: u.caregiverOf > 0,
      caregiverLinks: u.caregiverOf,
      patientLinks: u.caregivers,
      createdAt: iso(t0 - u.createdDaysAgo * DAY),
      lastSignInAt: iso(t0 - Math.min(u.createdDaysAgo, 2) * DAY),
    };
  };
  const bonoJson = (b: DemoBono): Row => ({
    id: b.id,
    name: b.name,
    days: b.days,
    maxUses: b.maxUses,
    uses: b.uses,
    note: b.note,
    createdAt: iso(b.createdAt),
    disabledAt: iso(b.disabledAt),
    state: b.disabledAt !== null ? 'disabled' : b.uses >= b.maxUses ? 'exhausted' : 'active',
  });
  const page = (p: Row, size: number) => {
    const n = Number(p.page ?? 0);
    return Number.isInteger(n) && n >= 0 ? n : 0;
  };
  const newSession = (via: string) => {
    const token = rid(64);
    sessions.set(token, { expiresAt: now() + 15 * 60_000, createdAt: now(), via });
    unlocks.unshift({ at: now(), via });
    return { session: token, expiresAt: iso(now() + 15 * 60_000) };
  };
  const status = () => ({
    hasPin: pin !== null,
    lockedUntil: lockedUntil && lockedUntil > now() ? iso(lockedUntil) : null,
    attemptsLeft: 5 - failed,
    devices: 0,
    name: opts.ownerName(),
    phone: mask(ownerUser.phone),
  });
  const checkPin = (value: unknown): Row | null => {
    if (pin === null) return { ok: false, error: 'PIN_NOT_SET' };
    if (lockedUntil && lockedUntil > now()) return { ok: false, error: 'LOCKED', lockedUntil: iso(lockedUntil) };
    if (value === pin) {
      failed = 0;
      lockedUntil = null;
      return null;
    }
    if (failed + 1 >= 5) {
      failed = 0;
      lockedUntil = now() + 15 * 60_000;
      log('owner_locked', null, { minutes: 15 });
      return { ok: false, error: 'LOCKED', lockedUntil: iso(lockedUntil) };
    }
    failed += 1;
    return { ok: false, error: 'PIN_INCORRECT', attemptsLeft: 5 - failed };
  };
  const subscriptionRows = (tab: string) => {
    const rows: Row[] = [];
    for (const u of users) {
      if (!u.paid || u === ownerUser) continue;
      const active = ['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(u.paid.state);
      if ((tab === 'active') !== active) continue;
      rows.push({ userId: u.id, name: u.name, phone: mask(u.phone), kind: 'paid', provider: u.paid.provider, state: u.paid.state, startsAt: iso(u.paid.start), endsAt: iso(u.paid.end), cancelAtPeriodEnd: !!u.paid.cancelling, paidByFamily: !!u.paid.family });
    }
    for (const g of grants.values()) {
      const active = g.revokedAt === null && (g.expiresAt === null || g.expiresAt > now());
      if ((tab === 'active') !== active) continue;
      const u = users.find((x) => x.phone === g.phone && !x.anonymous);
      rows.push({
        userId: u?.id ?? null,
        name: u?.name ?? null,
        phone: mask(g.phone),
        kind: 'courtesy',
        provider: 'courtesy',
        state: g.revokedAt !== null ? 'REVOKED' : active ? 'ACTIVE' : 'EXPIRED',
        startsAt: iso(g.grantedAt),
        endsAt: iso(g.revokedAt ?? g.expiresAt),
        cancelAtPeriodEnd: false,
        paidByFamily: false,
      });
    }
    return rows.sort((a, b) => String(b.startsAt).localeCompare(String(a.startsAt)));
  };
  const resolveTarget = (p: Row): { phone: string; user: DemoUser | null } | Result => {
    if (typeof p.userId === 'string' && p.userId) {
      const u = users.find((x) => x.id === p.userId);
      if (!u) return fail('NOT_FOUND');
      if (u.anonymous || !u.phone) return fail('USER_NO_PHONE');
      return { phone: u.phone, user: u };
    }
    if (typeof p.phone === 'string') {
      const n = normalizePhone(p.phone);
      if (!n) return fail('INVALID_PHONE');
      return { phone: n, user: users.find((x) => x.phone === n && !x.anonymous) ?? null };
    }
    return fail('INVALID_REQUEST');
  };
  const series = (days: number) => {
    const unit = days === 7 ? 'day' : days === 365 ? 'month' : 'week';
    const count = days === 7 ? 7 : days === 30 ? 5 : days === 90 ? 13 : 12;
    const out: Row[] = [];
    const today = new Date(now());
    for (let i = count - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      if (unit === 'day') d.setDate(d.getDate() - i);
      else if (unit === 'week') d.setDate(d.getDate() - i * 7 - ((d.getDay() + 6) % 7));
      else {
        d.setDate(1);
        d.setMonth(d.getMonth() - i);
      }
      const k = count - i;
      const scale = unit === 'day' ? 1 : unit === 'week' ? 7 : 30;
      out.push({
        bucket: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        doses: Math.round((38 + ((k * 7) % 11)) * scale),
        chats: Math.round((14 + ((k * 5) % 9)) * scale),
        emergencies: Math.round(((k * 3) % 4) * (scale > 1 ? scale / 7 : 1)),
        scans: Math.round((9 + ((k * 4) % 7)) * scale),
      });
    }
    return { unit, series: out };
  };

  function action(name: string, p: Row): Result {
    if (name === 'status') return ok(status());
    if (name === 'setup_pin') {
      if (pin !== null) return fail('PIN_ALREADY_SET');
      if (weakPin(p.pin)) return fail('PIN_WEAK');
      pin = String(p.pin);
      pinUpdatedAt = now();
      log('owner_pin_created');
      return ok({ ok: true, ...newSession('setup') });
    }
    if (name === 'unlock') {
      const check = checkPin(p.pin);
      if (check) return ok(check);
      log('owner_unlocked', null, { via: 'pin' });
      return ok({ ok: true, ...newSession('pin') });
    }
    if (name === 'unlock_device') return ok({ ok: false, error: 'DEVICE_INVALID' });

    const s = typeof p.session === 'string' ? sessions.get(p.session) : undefined;
    if (!s || s.expiresAt <= now()) return fail('OWNER_LOCKED');
    s.expiresAt = now() + 15 * 60_000;

    switch (name) {
      case 'lock':
        sessions.delete(String(p.session));
        return ok({ ok: true });
      case 'overview': {
        const premium = users.filter((u) => planOf(u) !== 'free').length;
        return ok({
          owner: status(),
          counts: {
            users: users.length,
            newUsers7d: users.filter((u) => u.createdDaysAgo <= 7).length,
            premium,
            paid: users.filter((u) => planOf(u) === 'paid').length,
            pastDue: users.filter((u) => u.paid?.state === 'PAST_DUE').length,
            courtesy: [...grants.values()].filter((g) => g.revokedAt === null && (g.expiresAt === null || g.expiresAt > now())).length,
            caregivers: users.filter((u) => u.caregiverOf > 0).length,
            bonosActive: bonos.filter((b) => b.disabledAt === null && b.uses < b.maxUses).length,
            activeIncidents: 0,
            errors24h: 1,
          },
          notice: notice && notice.enabled ? { id: notice.id, title: notice.title, message: notice.message, tone: notice.tone } : null,
          sessionExpiresAt: iso(s.expiresAt),
        });
      }
      case 'users': {
        const tab = String(p.tab ?? 'all');
        if (!['all', 'patients', 'caregivers'].includes(tab)) return fail('INVALID_REQUEST');
        const q = String(p.q ?? '').trim().toLowerCase();
        const digits = q.replace(/\D/g, '').replace(/^00/, '');
        let list = users.filter((u) => tab === 'all' || (tab === 'caregivers') === u.caregiverOf > 0);
        if (digits.length >= 6) list = list.filter((u) => (u.phone ?? '').includes(digits));
        else if (q.length >= 2) list = list.filter((u) => ((u === ownerUser ? opts.ownerName() : u.name) ?? '').toLowerCase().includes(q));
        list = [...list].sort((a, b) => a.createdDaysAgo - b.createdDaysAgo);
        const pg = page(p, 25);
        return ok({ total: list.length, page: pg, pageSize: 25, users: list.slice(pg * 25, pg * 25 + 25).map(userJson) });
      }
      case 'user': {
        const u = users.find((x) => x.id === p.userId);
        if (!u) return fail(typeof p.userId === 'string' && /^[0-9a-f-]{36}$/.test(p.userId) ? 'NOT_FOUND' : 'INVALID_REQUEST');
        log('owner_user_viewed', u.name);
        const use = u.phone ? [...bonoUses].reverse().find((x) => x.phone === u.phone) : undefined;
        const bono = use ? bonos.find((b) => b.id === use.bonoId) : undefined;
        const seed = u.createdDaysAgo;
        return ok({
          user: userJson(u),
          store: u.paid && (u.paid.provider === 'apple' || u.paid.provider === 'google')
            ? { platform: u.paid.provider, productId: u.paid.provider === 'apple' ? 'com.mediclaro.app.premium.annual' : 'mediclaro_premium', status: u.paid.state === 'ACTIVE' ? 'active' : 'expired', expiresAt: iso(u.paid.end), autoRenew: u.paid.state === 'ACTIVE' }
            : null,
          lastBono: bono && use ? { id: bono.id, name: bono.name, grantedAt: iso(use.createdAt) } : null,
          usage30d: { scans: u.anonymous ? 0 : (seed * 3) % 17, chats: u.anonymous ? 0 : (seed * 5) % 23, doses: u.caregiverOf ? 0 : (seed * 11) % 90 },
          lastActivityAt: iso(now() - ((seed % 5) + 1) * 3_600_000),
        });
      }
      case 'grant': {
        const target = resolveTarget(p);
        if ('error' in target) return target;
        let days: number | null;
        let bono: DemoBono | undefined;
        if (typeof p.bonoId === 'string') {
          bono = bonos.find((b) => b.id === p.bonoId);
          if (!bono) return fail('NOT_FOUND');
          if (bono.disabledAt !== null) return fail('BONO_DISABLED');
          if (bono.uses >= bono.maxUses) return fail('BONO_EXHAUSTED');
          if (bonoUses.some((x) => x.bonoId === bono?.id && x.phone === target.phone)) return fail('BONO_ALREADY_USED');
          days = bono.days;
        } else if ('days' in p) {
          if (p.days === null) days = null;
          else if (typeof p.days === 'number' && Number.isInteger(p.days) && p.days >= 1 && p.days <= 3650) days = p.days;
          else return fail('INVALID_REQUEST');
        } else return fail('INVALID_REQUEST');
        let exp = days === null ? null : now() + days * DAY;
        const prev = grants.get(target.phone);
        if (prev && prev.revokedAt === null && (prev.expiresAt === null || prev.expiresAt > now())) {
          if (prev.expiresAt === null) exp = null;
          else if (exp !== null && prev.expiresAt > exp) exp = prev.expiresAt;
        }
        grants.set(target.phone, { phone: target.phone, grantedAt: now(), expiresAt: exp, revokedAt: null });
        if (bono) {
          bonoUses.push({ id: useSeq++, bonoId: bono.id, phone: target.phone, createdAt: now(), expiresAt: exp });
          bono.uses += 1;
        }
        log('courtesy_premium_granted', target.user?.name ?? null, { bono_name: bono?.name ?? null, expires_at: iso(exp), lifetime: exp === null, days });
        return ok({
          ok: true,
          phone: mask(target.phone),
          verified: !!target.user,
          expiresAt: iso(exp),
          lifetime: exp === null,
          user: target.user ? userJson(target.user) : null,
          bono: bono ? { id: bono.id, name: bono.name, uses: bono.uses, maxUses: bono.maxUses } : null,
        });
      }
      case 'revoke': {
        const target = resolveTarget(p);
        if ('error' in target) return target;
        const g = grants.get(target.phone);
        const changed = !!g && g.revokedAt === null;
        if (g && changed) g.revokedAt = now();
        if (changed) log('courtesy_premium_revoked', target.user?.name ?? null);
        return ok({ ok: true, changed, phone: mask(target.phone) });
      }
      case 'bonos': {
        const st = String(p.state ?? 'all');
        if (!['all', 'active', 'finished'].includes(st)) return fail('INVALID_REQUEST');
        const isActive = (b: DemoBono) => b.disabledAt === null && b.uses < b.maxUses;
        const list = bonos.filter((b) => st === 'all' || (st === 'active') === isActive(b)).sort((a, b) => b.createdAt - a.createdAt);
        const pg = page(p, 25);
        return ok({
          total: list.length,
          page: pg,
          pageSize: 25,
          bonos: list.slice(pg * 25, pg * 25 + 25).map(bonoJson),
          activeCount: bonos.filter(isActive).length,
          usesLeft: bonos.filter((b) => b.disabledAt === null).reduce((n, b) => n + b.maxUses - b.uses, 0),
        });
      }
      case 'bono_create': {
        const nameValue = typeof p.name === 'string' ? p.name.trim() : '';
        if (!nameValue || nameValue.length > 60) return fail('INVALID_NAME');
        if (!('days' in p) || !(p.days === null || (typeof p.days === 'number' && Number.isInteger(p.days) && p.days >= 1 && p.days <= 3650))) return fail('INVALID_REQUEST');
        if (typeof p.maxUses !== 'number' || !Number.isInteger(p.maxUses) || p.maxUses < 1 || p.maxUses > 1000) return fail('INVALID_USES');
        const b: DemoBono = { id: uuid(), name: nameValue, days: p.days as number | null, maxUses: p.maxUses, uses: 0, note: typeof p.note === 'string' && p.note.trim() ? p.note.trim() : null, createdAt: now(), disabledAt: null };
        bonos.push(b);
        log('owner_bono_created', null, { bono_name: b.name, days: b.days, lifetime: b.days === null, max_uses: b.maxUses });
        return ok(bonoJson(b));
      }
      case 'bono': {
        const b = bonos.find((x) => x.id === p.bonoId);
        if (!b) return fail('NOT_FOUND');
        const uses = bonoUses
          .filter((x) => x.bonoId === b.id)
          .sort((a, c) => c.createdAt - a.createdAt)
          .map((x) => {
            const u = users.find((y) => y.phone === x.phone && !y.anonymous);
            const g = grants.get(x.phone);
            return {
              id: x.id,
              userId: u?.id ?? null,
              name: u?.name ?? null,
              phone: mask(x.phone),
              verified: !!u,
              createdAt: iso(x.createdAt),
              expiresAt: iso(g?.expiresAt ?? null),
              active: !!g && g.revokedAt === null && (g.expiresAt === null || g.expiresAt > now()),
            };
          });
        return ok({ bono: bonoJson(b), uses });
      }
      case 'bono_disable':
      case 'bono_enable': {
        const b = bonos.find((x) => x.id === p.bonoId);
        if (!b) return fail('NOT_FOUND');
        b.disabledAt = name === 'bono_enable' ? null : b.disabledAt ?? now();
        log(name === 'bono_enable' ? 'owner_bono_enabled' : 'owner_bono_disabled', null, { bono_name: b.name });
        return ok(bonoJson(b));
      }
      case 'subscriptions': {
        const tab = String(p.tab ?? 'active');
        if (!['active', 'history'].includes(tab)) return fail('INVALID_REQUEST');
        const rows = subscriptionRows(tab);
        const pg = page(p, 25);
        const activePaid = users.filter((u) => u !== ownerUser && u.paid && ['ACTIVE', 'TRIAL', 'PAST_DUE'].includes(u.paid.state));
        return ok({
          total: rows.length,
          page: pg,
          pageSize: 25,
          rows: rows.slice(pg * 25, pg * 25 + 25),
          totals: {
            paid: activePaid.length,
            trial: activePaid.filter((u) => u.paid?.state === 'TRIAL').length,
            pastDue: activePaid.filter((u) => u.paid?.state === 'PAST_DUE').length,
            cancelling: activePaid.filter((u) => u.paid?.cancelling).length,
            courtesy: subscriptionRows('active').filter((r) => r.kind === 'courtesy').length,
          },
        });
      }
      case 'stats': {
        const days = Number(p.days ?? 30);
        if (![7, 30, 90, 365].includes(days)) return fail('INVALID_RANGE');
        const { unit, series: s2 } = series(days);
        const sum = (k: string) => s2.reduce((n, b) => n + Number(b[k] ?? 0), 0);
        return ok({
          days,
          unit,
          since: iso(now() - days * DAY),
          generatedAt: iso(now()),
          kpis: {
            activeUsers: Math.min(users.length, 7 + Math.round(days / 30)),
            newUsers: users.filter((u) => u.createdDaysAgo <= days).length,
            doses: sum('doses'),
            scans: sum('scans'),
            chats: sum('chats'),
            emergencies: sum('emergencies'),
            careMessages: Math.round(sum('chats') * 0.6),
            calls: Math.round(sum('emergencies') * 3 + days / 7),
            bonosUsed: bonoUses.filter((x) => x.createdAt >= now() - days * DAY).length,
            premiumActive: users.filter((u) => planOf(u) !== 'free').length,
            paidActive: users.filter((u) => planOf(u) === 'paid').length,
            users: users.length,
          },
          series: s2,
        });
      }
      case 'audit': {
        const tab = String(p.tab ?? 'activity');
        const pg = page(p, 30);
        const rows =
          tab === 'events'
            ? events.sort((a, b) => b.at - a.at).map((e) => ({ id: e.id, action: e.action, createdAt: iso(e.at), actor: e.actor, target: null, detail: {} }))
            : [...audit].sort((a, b) => b.at - a.at || b.id - a.id).map((a) => ({ id: `a${a.id}`, action: a.action, createdAt: iso(a.at), actor: a.actor, target: a.target, detail: a.detail }));
        return ok({ tab, page: pg, pageSize: 30, rows: rows.slice(pg * 30, pg * 30 + 30) });
      }
      case 'notice_get':
        return ok({ notice });
      case 'notice_set': {
        if (typeof p.enabled !== 'boolean') return fail('INVALID_REQUEST');
        const tone = String(p.tone ?? 'info');
        if (!['info', 'warning', 'success'].includes(tone)) return fail('INVALID_REQUEST');
        const title = String(p.title ?? '').trim();
        const message = String(p.message ?? '').trim();
        if (title.length > 60 || message.length > 280 || (p.enabled && message.length < 3)) return fail('INVALID_NOTICE');
        const until = typeof p.until === 'string' ? Date.parse(p.until) : null;
        if (until !== null && (Number.isNaN(until) || until <= now() || until > now() + 90 * DAY)) return fail('INVALID_NOTICE');
        notice = { id: rid(16), enabled: p.enabled, title: title || null, message, tone, until: until === null ? null : iso(until), updatedAt: iso(now()) };
        log('owner_notice_updated', null, { enabled: p.enabled, tone });
        return ok({ notice });
      }
      case 'system':
        return ok({
          serverTime: iso(now()),
          database: 'ok',
          features: { medication: true, careChat: true, familyPay: true },
          queues: [
            { key: 'care_push_jobs', label: 'Avisos de ayuda', pending: 0, failed24h: 0, delivered24h: 3 },
            { key: 'care_link_push_jobs', label: 'Vinculaciones', pending: 0, failed24h: 0, delivered24h: 2 },
            { key: 'medication_alert_jobs', label: 'Pastillas', pending: 1, failed24h: 1, delivered24h: 41 },
            { key: 'care_chat_push_jobs', label: 'Chat con el cuidador/a', pending: 0, failed24h: 0, delivered24h: 12 },
            { key: 'care_call_push_jobs', label: 'Llamadas', pending: 0, failed24h: 0, delivered24h: 2 },
          ],
          cron: [
            { name: 'mediclaro-care-chat-cleanup', schedule: '23 3 * * *', active: true, lastStatus: 'succeeded', lastRunAt: iso(now() - 9 * 3_600_000) },
            { name: 'mediclaro-expire-bizum-premium', schedule: '*/5 * * * *', active: true, lastStatus: 'succeeded', lastRunAt: iso(now() - 120_000) },
            { name: 'mediclaro-owner-cleanup', schedule: '41 3 * * *', active: true, lastStatus: 'succeeded', lastRunAt: iso(now() - 9 * 3_600_000) },
          ],
          errors24h: 1,
          aiCost24h: 0.42,
          activeIncidents: 0,
          storeVerification: false,
          notice: !!notice?.enabled,
        });
      case 'export': {
        const kind = String(p.kind ?? '');
        let columns: string[];
        let rows: unknown[][];
        if (kind === 'users') {
          columns = ['Nombre', 'Teléfono', 'Plan', 'Cobro', 'Estado', 'Cuidador/a', 'Alta'];
          rows = users.map((u) => {
            const j = userJson(u);
            return [j.name, j.phone, j.plan, j.provider, j.subState, u.caregiverOf ? 'sí' : 'no', j.createdAt];
          });
        } else if (kind === 'subscriptions') {
          columns = ['Nombre', 'Teléfono', 'Tipo', 'Cobro', 'Estado', 'Desde', 'Hasta', 'Cancelada al final del periodo', 'La paga un familiar'];
          rows = [...subscriptionRows('active'), ...subscriptionRows('history')].map((r) => [r.name, r.phone, r.kind, r.provider, r.state, r.startsAt, r.endsAt, r.cancelAtPeriodEnd ? 'sí' : 'no', r.paidByFamily ? 'sí' : 'no']);
        } else if (kind === 'bonos') {
          columns = ['Bono', 'Días (vacío = vitalicio)', 'Usos', 'Máximo', 'Estado', 'Creado'];
          rows = bonos.map((b) => {
            const j = bonoJson(b);
            return [b.name, b.days, b.uses, b.maxUses, j.state, j.createdAt];
          });
        } else if (kind === 'audit') {
          columns = ['Fecha', 'Acción', 'Quién'];
          rows = audit.map((a) => [iso(a.at), a.action, a.actor]);
        } else return fail('INVALID_REQUEST');
        log('owner_export', null, { kind, rows: rows.length });
        return ok({ kind, generatedAt: iso(now()), columns, rows });
      }
      case 'account':
        return ok({ ...status(), pinUpdatedAt: iso(pinUpdatedAt), sessions: sessions.size, recentUnlocks: unlocks.slice(0, 5).map((u) => ({ at: iso(u.at), via: u.via })) });
      case 'devices':
        return ok({ devices: [] });
      case 'device_revoke':
        return ok({ ok: true });
      case 'trust_device': {
        const check = checkPin(p.pin);
        return ok(check ?? { ok: false, error: 'DEVICE_INVALID' });
      }
      case 'change_pin': {
        const check = checkPin(p.currentPin);
        if (check) return ok(check);
        if (weakPin(p.newPin)) return fail('PIN_WEAK');
        if (p.newPin === p.currentPin) return fail('PIN_SAME');
        pin = String(p.newPin);
        pinUpdatedAt = now();
        for (const k of sessions.keys()) if (k !== p.session) sessions.delete(k);
        log('owner_pin_changed');
        return ok({ ok: true });
      }
      default:
        return fail('INVALID_ACTION');
    }
  }

  return {
    rpc(_name: string, args: unknown): Result {
      const a = (args ?? {}) as { p_action?: unknown; p_payload?: unknown };
      const payload = a.p_payload && typeof a.p_payload === 'object' && !Array.isArray(a.p_payload) ? (a.p_payload as Row) : {};
      return action(String(a.p_action ?? '').toLowerCase(), payload);
    },
    /** Lo que ve cualquier persona en Inicio (app_notice). */
    notice(): Row | null {
      if (!notice || notice.enabled !== true) return null;
      if (typeof notice.until === 'string' && Date.parse(notice.until) <= now()) return null;
      return { id: notice.id, title: notice.title, message: notice.message, tone: notice.tone, until: notice.until };
    },
  };
}

export type DemoOwner = ReturnType<typeof createDemoOwner>;
