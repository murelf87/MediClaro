/**
 * MODO DEMOSTRACIÓN / QA — backend simulado en memoria (datos de ejemplo aislados en src/mocks).
 *
 * Permite recorrer TODA la app sin verificar el móvil ni conectar con el servidor
 * (botón "Entrar sin verificar" del login, solo en compilaciones de desarrollo y
 * preview: ver DEMO_ACCESS_ENABLED en src/config/app.ts).
 *
 * - Misma interfaz que el cliente Supabase que usan los servicios.
 * - Respuestas con la forma EXACTA del backend real (Edge Functions y tablas).
 * - Los datos son de ejemplo y la app muestra siempre el aviso "Modo demostración".
 * - También lo usa la QA visual (scripts/qa-web.sh) con escenarios (?qa=...).
 */
import {
  DEMO_PHONE,
  DEMO_USER_ID,
  demoAccountStatus,
  demoAmbiguous,
  demoChatEmergency,
  demoChatAnswer,
  demoDetail,
  demoEmergencyConfig,
  demoEmergencyProfile,
  demoIdentified,
  demoNotFound,
  demoPlanConfig,
  demoPlansConfig,
  demoProfileRow,
  demoSavedMedications,
  demoScans,
} from './demoData';
import { createDemoCare, DEMO_PATIENT_ID } from './demoCare';
import { createDemoMedication, type DemoLinkView } from './demoMedication';
import { createDemoOwner } from './demoOwner';
import { parsePlan } from '../services/pills/planStore';
import { answerMedicationQuestion, detectMedicationIntent, deviceZone } from '../domain/medication';

type Row = Record<string, unknown>;
type Result = { data: unknown; error: unknown };

export interface DemoBackendOptions {
  /**
   * Escenarios de QA: signedout, empty, error, premium, premiumonly (el servidor exige Premium: R-24), ambiguous, notfound, limit, chatlimit, chatemergency, noassist,
   * noprofile, slow, anon, big, r01, cancelling, cuidador (cuenta gratuita de cuidador/a vinculada a una paciente Premium),
   * propietario (la cuenta es la del propietario: Panel de propietario con datos inventados).
   * Pagos: plans1 (sin catálogo remoto: respaldo local), anondisabled (Supabase sin accesos anónimos), phoneexists
   * (el número ya tiene cuenta), noiapverify (falta la función iap-verify), iapconflict (compra de otra cuenta),
   * storeerror, storepending, storeowned, nostore, nocard, google (simula Google Play), applesub / googlesub (Premium
   * contratado con Apple / Google Play).
   */
  scenario?: Set<string>;
  startSignedIn?: boolean;
  /** Cuenta sin teléfono (pagar antes de registrarse). */
  anonymous?: boolean;
}

const PERIOD_MONTHS: Record<string, number> = { monthly: 1, quarterly: 3, annual: 12 };

/** Lee el escenario de QA de la URL (?qa=...) — solo tiene efecto en la build web de QA. */
export function readQaScenario(): Set<string> {
  const g = globalThis as unknown as { location?: { search?: string }; sessionStorage?: Storage };
  let raw = '';
  try {
    if (!g.location?.search && !g.sessionStorage) return new Set();
    const params = new URLSearchParams(g.location?.search ?? '');
    const fromUrl = params.get('qa');
    if (fromUrl !== null) {
      g.sessionStorage?.setItem('mediclaro-qa', fromUrl);
      raw = fromUrl;
    } else {
      raw = g.sessionStorage?.getItem('mediclaro-qa') ?? '';
    }
  } catch {
    raw = '';
  }
  return new Set(raw.split(',').map((s) => s.trim()).filter(Boolean));
}

export function createDemoBackend(opts: DemoBackendOptions = {}) {
  const scenario = opts.scenario ?? new Set<string>();
  const has = (k: string) => scenario.has(k);
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, has('slow') ? ms * 4 : ms));

  // 'cuidador': cuenta gratuita de un cuidador (Javier) vinculado a una paciente Premium (María).
  const caregiverDemo = has('cuidador');
  const db: Record<string, Row[]> = {
    saved_medications: has('empty') || caregiverDemo ? [] : demoSavedMedications.map((r) => ({ ...r })),
    scans: has('empty') || caregiverDemo ? [] : demoScans().map((r) => ({ ...r })),
    emergency_profiles: has('empty') || has('noprofile') || caregiverDemo ? [] : [{ ...demoEmergencyProfile }],
    // 'cancelling': Premium cancelado con efecto al final del periodo (R-10).
    profiles: [
      {
        ...demoProfileRow(has('premium')),
        cancel_at_period_end: has('cancelling'),
        // Suscripción contratada con la tienda (applesub / googlesub) en lugar de con tarjeta.
        ...(has('applesub') ? { billing_provider: 'apple' } : has('googlesub') ? { billing_provider: 'google' } : null),
      },
    ],
    plan_config: demoPlanConfig.map((r) => ({ ...r })),
    app_config: [
      { key: 'emergency', value: has('noassist') ? { ...demoEmergencyConfig, primaryAssistanceNumber: '' } : { ...demoEmergencyConfig } },
      ...(has('plans1') ? [] : [{ key: 'plans', value: JSON.parse(JSON.stringify(demoPlansConfig)) as Row }]),
    ],
  };

  // Perfil editable de la demostración: lo que se guarda en «Completa tu perfil» / Ajustes se ve al volver.
  // Sin sesión al empezar ('signedout'): persona nueva, con el perfil por completar.
  const newPerson = opts.startSignedIn === false || has('signedout') || has('newprofile');
  const demoSettings: Row = {
    ...demoAccountStatus(false).settings,
    ...(newPerson ? { display_name: '', onboarded: false } : caregiverDemo ? { display_name: 'Javier Martín' } : has('propietario') ? { display_name: 'Antonio' } : null),
  };
  Object.assign(db.profiles[0], newPerson
    ? { sex: null, age: null, contact_phone: null, avatar_path: null }
    : caregiverDemo
      ? { sex: 'male', age: 52, contact_phone: null, avatar_path: null }
      : { sex: 'female', age: 78, contact_phone: null, avatar_path: null });
  const avatars = new Map<string, string>();
  const care = createDemoCare({
    isPremium: () => db.profiles[0]?.plan === 'premium',
    myName: () => String(demoSettings.display_name || 'María García'),
    empty: has('empty'),
    caregiverOf: caregiverDemo ? 'María García' : undefined,
  });
  // Panel del propietario (solo en el escenario «propietario»): personas, bonos y cifras inventadas.
  const ownerDemo = has('propietario');
  const owner = createDemoOwner({
    ownerId: DEMO_USER_ID,
    ownerName: () => String(demoSettings.display_name || 'Antonio'),
    // Teléfono del propietario (Antonio); el de la propietaria (Marina) está en los datos del panel.
    ownerPhone: has('propietario') ? '+34680127015' : DEMO_PHONE,
  });
  // «Mis pastillas»: pauta y tomas de ejemplo (de María en el escenario «cuidador/a»).
  const medication = createDemoMedication({
    isPremium: () => db.profiles[0]?.plan === 'premium',
    links: () => {
      const snapshot = care.rpc('caregiver_action', { p_action: 'snapshot' }).data as { links?: DemoLinkView[] } | null;
      return snapshot?.links ?? [];
    },
    seed: has('empty') ? 'empty' : caregiverDemo ? 'caregiver' : 'patient',
    patientId: DEMO_PATIENT_ID,
  });

  let signedIn = opts.startSignedIn ?? true;
  let anonymous = has('anon') || opts.anonymous === true;
  // En el escenario «propietario» la cuenta es la de Antonio (su teléfono real de propietario).
  let phone: string | null = anonymous ? null : has('propietario') ? '+34680127015' : DEMO_PHONE;
  let pendingPhone: string | null = null;
  const session = () => ({
    access_token: 'demo',
    user: {
      id: DEMO_USER_ID,
      phone: phone ? phone.replace('+', '') : null,
      email: null,
      is_anonymous: anonymous,
    },
  });
  const authListeners = new Set<(event: string, s: unknown) => void>();
  const networkError = { message: 'Network request failed', code: 'NETWORK' };

  class Query implements PromiseLike<Result> {
    private filters: [string, unknown][] = [];
    private mode: 'select' | 'upsert' | 'update' | 'delete' | 'insert' = 'select';
    private payload: Row | null = null;
    private singleMode: 'none' | 'maybe' | 'one' = 'none';
    private limitN: number | null = null;
    private orders: [string, boolean][] = [];

    constructor(private table: string) {}

    select(_cols?: string) { return this; }
    eq(col: string, val: unknown) { this.filters.push([col, val]); return this; }
    order(col: string, o?: { ascending?: boolean }) { this.orders.push([col, o?.ascending ?? true]); return this; }
    limit(n: number) { this.limitN = n; return this; }
    maybeSingle() { this.singleMode = 'maybe'; return this; }
    single() { this.singleMode = 'one'; return this; }
    upsert(row: Row, _o?: unknown) { this.mode = 'upsert'; this.payload = row; return this; }
    insert(row: Row) { this.mode = 'insert'; this.payload = row; return this; }
    update(patch: Row) { this.mode = 'update'; this.payload = patch; return this; }
    delete() { this.mode = 'delete'; return this; }

    private rows(): Row[] {
      return (db[this.table] ?? []).filter((r) => this.filters.every(([c, v]) => r[c] === v));
    }

    private async run(): Promise<Result> {
      await delay(220);
      if (has('error') && this.table !== 'app_config' && this.table !== 'plan_config') return { data: null, error: networkError };
      const table = db[this.table] ?? (db[this.table] = []);
      if (this.mode === 'upsert' || this.mode === 'insert') {
        const row = { ...this.payload } as Row;
        const key = this.table === 'saved_medications' ? 'nregistro' : 'user_id';
        const idx = table.findIndex((r) => r[key] === row[key]);
        if (idx >= 0) table[idx] = { ...table[idx], ...row };
        else table.unshift({ id: Date.now(), created_at: new Date().toISOString(), favorito: false, ...row });
        return { data: null, error: null };
      }
      if (this.mode === 'update') {
        this.rows().forEach((r) => Object.assign(r, this.payload));
        return { data: null, error: null };
      }
      if (this.mode === 'delete') {
        db[this.table] = table.filter((r) => !this.filters.every(([c, v]) => r[c] === v));
        return { data: null, error: null };
      }
      let rows = this.rows();
      for (const [col, asc] of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => {
          const av = a[col] as string | number | boolean;
          const bv = b[col] as string | number | boolean;
          if (av === bv) return 0;
          return (av > bv ? 1 : -1) * (asc ? 1 : -1);
        });
      }
      if (this.limitN !== null) rows = rows.slice(0, this.limitN);
      if (this.singleMode === 'maybe') return { data: rows[0] ?? null, error: null };
      if (this.singleMode === 'one') {
        return rows[0] ? { data: rows[0], error: null } : { data: null, error: { message: 'No rows', code: 'PGRST116' } };
      }
      return { data: rows, error: null };
    }

    then<T1 = Result, T2 = never>(
      onfulfilled?: ((value: Result) => T1 | PromiseLike<T1>) | null,
      onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
    ): PromiseLike<T1 | T2> {
      return this.run().then(onfulfilled, onrejected);
    }
  }

  type CatalogPlan = { id: string; period: string; priceCents: number };
  function catalogPlan(id: string): CatalogPlan {
    const plans = (demoPlansConfig.plans as CatalogPlan[]);
    return plans.find((p) => p.id === id) ?? plans[0];
  }
  function productPlanId(productId: string): string {
    if (/annual/.test(productId)) return 'premium_annual';
    if (/quarterly/.test(productId)) return 'premium_quarterly';
    return 'premium_monthly';
  }
  function setPremium(
    value: boolean,
    provider: 'stripe' | 'apple' | 'google' = 'stripe',
    period = 'monthly',
    how: 'subscription' | 'bizum' | 'family' = 'subscription',
  ) {
    const p = db.profiles[0];
    if (!p) return;
    // Bizum: se suma al final si ya había Premium pagado con Bizum (como el webhook real).
    const chained = value && how === 'bizum' && p.payment_kind === 'bizum' && p.plan === 'premium' && typeof p.current_period_end === 'string' && Date.parse(p.current_period_end) > Date.now();
    p.plan = value ? 'premium' : 'free';
    p.subscription_status = value ? 'active' : null;
    const end = chained ? new Date(String(p.current_period_end)) : new Date();
    end.setMonth(end.getMonth() + (PERIOD_MONTHS[period] ?? 1));
    p.current_period_end = value ? end.toISOString() : null;
    p.billing_provider = provider;
    p.cancel_at_period_end = value && how === 'bizum';
    p.payment_kind = value ? (how === 'bizum' ? 'bizum' : 'subscription') : null;
    p.paid_by_family = value && how === 'family';
  }

  function httpError(status: number, error: string, code?: string): Result {
    return {
      data: null,
      error: { name: 'FunctionsHttpError', message: error, context: { status, json: async () => ({ error, code }) } },
    };
  }

  async function invoke(name: string, o?: { body?: Record<string, unknown> }): Promise<Result> {
    const body = o?.body ?? {};
    switch (name) {
      case 'identify-medicine':
        await delay(2600);
        if (has('premiumonly')) return httpError(402, 'Función solo para Premium.', 'PREMIUM_REQUIRED');
        if (has('limit')) return httpError(402, 'Ha llegado al límite de identificaciones de este mes.', 'LIMIT_REACHED');
        if (has('notfound')) return { data: demoNotFound, error: null };
        if (has('ambiguous')) return { data: demoAmbiguous, error: null };
        db.scans.unshift({
          id: Date.now(), user_id: DEMO_USER_ID, nregistro: demoIdentified.best.id, nombre: demoIdentified.best.nombre,
          confidence: 'alta', created_at: new Date().toISOString(), status: 'identified', score: 0.97,
          method: body.barcode ? 'barcode' : 'ocr',
        });
        return { data: demoIdentified, error: null };
      case 'medicine-detail':
        await delay(450);
        if (has('error')) return { data: null, error: { name: 'FunctionsFetchError', message: 'Failed to fetch', context: new TypeError('Failed to fetch') } };
        return { data: demoDetail(String(body.id ?? demoIdentified.best.id)), error: null };
      case 'chat':
        await delay(1200);
        if (has('premiumonly')) return httpError(402, 'Función solo para Premium.', 'PREMIUM_REQUIRED');
        if (has('chatlimit')) return httpError(402, 'Ha llegado al límite de preguntas de hoy. Mañana podrá seguir.', 'CHAT_LIMIT');
        if (has('chatemergency')) return { data: demoChatEmergency, error: null };
        {
          // Lo último que ha escrito la persona (y, si pregunta desde la ficha de un medicamento, cuál es).
          const msgs = Array.isArray(body.messages) ? (body.messages as { role?: unknown; content?: unknown }[]) : [];
          const last = [...msgs].reverse().find((m) => m?.role === 'user');
          const question = typeof last?.content === 'string' ? last.content : '';
          const medicineId = typeof body.medicineId === 'string' ? body.medicineId : null;
          // Igual que el servidor: las preguntas sobre SUS tomas se responden con la pauta y los registros (sin IA).
          const plan = medication.rpc('medication_get_plan', {});
          if (!plan.error) {
            const snapshot = parsePlan(plan.data, new Date().toISOString());
            const match = detectMedicationIntent(question, snapshot.treatments);
            if (match) {
              const reply = answerMedicationQuestion(match, { now: new Date(), zone: deviceZone(), treatments: snapshot.treatments, events: snapshot.events });
              return { data: { reply, sourceUrl: null, kind: 'medication' }, error: null };
            }
          }
          return { data: demoChatAnswer(question, medicineId), error: null };
        }
      case 'create-checkout': {
        await delay(600);
        const bizum = body.method === 'bizum';
        const method = body.method === 'bizum' || body.method === 'sepa' || body.method === 'paypal' ? body.method : null;
        if (body.method !== undefined && !method) return httpError(400, 'Forma de pago no válida', 'METHOD_NOT_AVAILABLE');
        // Con Bizum se puede pagar el periodo siguiente antes de que acabe el que ya está pagado con Bizum.
        if (db.profiles[0]?.plan === 'premium' && !(bizum && db.profiles[0]?.payment_kind === 'bizum')) {
          return httpError(409, 'Ya tiene una suscripción activa.');
        }
        const plan = catalogPlan(typeof body.planId === 'string' ? body.planId : 'premium_monthly');
        const query = `plan=${plan.id}&period=${plan.period}&amount=${plan.priceCents}${method ? `&method=${method}` : ''}`;
        return { data: { url: `https://checkout.stripe.com/c/pay/demo?${query}` }, error: null };
      }
      case 'family-pay': {
        await delay(500);
        if (body.action !== 'create') return httpError(400, 'Acción no válida');
        if (db.profiles[0]?.plan === 'premium') return httpError(409, 'Ya tiene una suscripción activa.');
        const plan = catalogPlan(typeof body.planId === 'string' ? body.planId : 'premium_monthly');
        const token = Math.random().toString(36).slice(2, 12) + Math.random().toString(36).slice(2, 12);
        const name = String(demoSettings.display_name || '').trim().split(/\s+/)[0] || null;
        return {
          data: {
            url: `https://mediclaro.app/pagar?t=demo-${token}`,
            expiresAt: new Date(Date.now() + 7 * 86_400_000).toISOString(),
            beneficiaryName: name,
            planId: plan.id,
          },
          error: null,
        };
      }
      case 'demo-family-complete': {
        // Simula que el familiar paga en la página segura y el webhook activa Premium en esta cuenta.
        await delay(300);
        const plan = catalogPlan(typeof body.planId === 'string' ? body.planId : 'premium_monthly');
        setPremium(true, 'stripe', plan.period, 'family');
        return { data: { ok: true }, error: null };
      }
      case 'demo-checkout-complete': {
        // Simula el webhook de Stripe tras pagar en la página segura.
        await delay(300);
        const plan = catalogPlan(typeof body.planId === 'string' ? body.planId : 'premium_monthly');
        setPremium(true, 'stripe', plan.period, body.method === 'bizum' ? 'bizum' : 'subscription');
        return { data: { ok: true }, error: null };
      }
      case 'iap-verify': {
        await delay(900);
        if (has('noiapverify')) return httpError(404, 'Requested function was not found', 'NOT_FOUND');
        if (has('iapconflict')) return httpError(409, 'Esta compra pertenece a otra cuenta.', 'OWNED_BY_OTHER_ACCOUNT');
        if (typeof body.purchaseToken !== 'string' || !body.purchaseToken) return httpError(400, 'Compra no válida');
        const plan = catalogPlan(typeof body.planId === 'string' ? body.planId : productPlanId(String(body.productId ?? '')));
        const provider = body.platform === 'google' ? 'google' : 'apple';
        setPremium(true, provider, plan.period);
        const p = db.profiles[0];
        return {
          data: { isPremium: true, plan: 'premium', provider, currentPeriodEnd: p?.current_period_end ?? null },
          error: null,
        };
      }
      case 'customer-portal':
        await delay(600);
        return { data: { url: 'https://billing.stripe.com/p/session/demo' }, error: null };
      case 'account':
        await delay(700);
        if (body.action === 'export') {
          return {
            data: {
              exportedAt: new Date().toISOString(),
              aviso: 'Datos de demostración',
              profile: demoAccountStatus(db.profiles[0]?.plan === 'premium').settings,
              myMedications: db.saved_medications,
              history: db.scans,
            },
            error: null,
          };
        }
        if (body.action === 'delete') return { data: { deleted: true }, error: null };
        return httpError(400, 'Acción no válida');
      default:
        return httpError(404, 'No encontrado');
    }
  }

  return {
    auth: {
      async getSession() {
        await delay(40);
        return { data: { session: signedIn ? session() : null }, error: null };
      },
      async getUser() {
        return { data: { user: signedIn ? session().user : null }, error: null };
      },
      onAuthStateChange(cb: (event: string, s: unknown) => void) {
        authListeners.add(cb);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(cb) } } };
      },
      async signInWithOtp(_args: unknown) {
        await delay(700);
        return { data: {}, error: null };
      },
      async signInAnonymously() {
        await delay(300);
        if (has('anondisabled')) {
          return {
            data: { session: null, user: null },
            error: { name: 'AuthApiError', status: 422, code: 'anonymous_provider_disabled', message: 'Anonymous sign-ins are disabled' },
          };
        }
        signedIn = true;
        anonymous = true;
        phone = null;
        authListeners.forEach((l) => l('SIGNED_IN', session()));
        return { data: { session: session(), user: session().user }, error: null };
      },
      async updateUser(attrs: { phone?: string }) {
        await delay(600);
        if (!signedIn) return { data: { user: null }, error: { status: 401, message: 'Auth session missing!' } };
        if (attrs.phone) {
          if (has('phoneexists')) {
            return { data: { user: null }, error: { status: 422, code: 'phone_exists', message: 'Phone number already registered by another user' } };
          }
          pendingPhone = attrs.phone;
        }
        return { data: { user: session().user }, error: null };
      },
      async verifyOtp(args: { token: string; phone?: string; type?: string }) {
        await delay(700);
        if (args.token !== '123456') {
          return { data: { session: null }, error: { code: 'otp_expired', message: 'Token has expired or is invalid' } };
        }
        if (args.type === 'phone_change') {
          phone = pendingPhone ?? args.phone ?? phone;
          pendingPhone = null;
          anonymous = false;
          authListeners.forEach((l) => l('USER_UPDATED', session()));
          return { data: { session: session(), user: session().user }, error: null };
        }
        signedIn = true;
        anonymous = false;
        phone = args.phone ?? DEMO_PHONE;
        authListeners.forEach((l) => l('SIGNED_IN', session()));
        return { data: { session: session() }, error: null };
      },
      async signOut(_o?: unknown) {
        signedIn = false;
        authListeners.forEach((l) => l('SIGNED_OUT', null));
        return { error: null };
      },
      async refreshSession() {
        return { data: { session: signedIn ? session() : null }, error: null };
      },
      startAutoRefresh() {},
      stopAutoRefresh() {},
    },
    from(table: string) {
      return new Query(table);
    },
    async rpc(name: string, _args?: unknown): Promise<Result> {
      await delay(180);
      if (has('error')) return { data: null, error: networkError };
      if (name === 'get_account_status') {
        if (!signedIn) return { data: null, error: null };
        const premium = db.profiles[0]?.plan === 'premium';
        // 'r01': reproduce el defecto del backend real (el webhook no escribe sub_state):
        // la persona ve Premium, pero el servidor le aplica los límites gratuitos.
        const base = { ...demoAccountStatus(premium && !has('r01')), settings: { ...demoSettings } };
        const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        const used = db.scans.filter((r) => r.status !== 'not_found' && new Date(String(r.created_at)).getTime() >= monthStart).length;
        // Escenario 'big': texto «Muy grande» + Modo fácil (QA de desbordamientos)
        const settings = has('big') ? { ...base.settings, font_size: 'muy_grande', easy_mode: true } : base.settings;
        const p = db.profiles[0];
        return {
          data: {
            ...base,
            settings,
            scans_this_period: used,
            free_scans_left: Math.max(0, base.included_scans - used),
            payment_kind: premium ? (p?.payment_kind ?? 'subscription') : null,
            paid_by_family: premium && p?.paid_by_family === true,
          },
          error: null,
        };
      }
      if (name === 'update_my_settings') {
        const patch = ((_args as { p?: Row } | undefined)?.p ?? {}) as Row;
        const profile = db.profiles[0];
        for (const [key, value] of Object.entries(patch)) {
          if (['sex', 'age', 'contact_phone', 'avatar_path'].includes(key)) {
            if (profile) profile[key] = value;
          } else {
            demoSettings[key] = value;
          }
        }
        return { data: null, error: null };
      }
      if (name.startsWith('medication_')) {
        return signedIn ? medication.rpc(name, _args) : { data: null, error: { message: 'AUTH_REQUIRED' } };
      }
      if (name === 'caregiver_action' || name === 'care_pairing_action' || name === 'caregiver_call' || name === 'care_chat_action' || name === 'care_call_action') {
        return signedIn ? care.rpc(name, _args) : { data: null, error: { message: 'NOT_ALLOWED' } };
      }
      // Historial persistente del asistente: la demostración empieza con la conversación vacía.
      if (name === 'my_assistant_history') return { data: [], error: null };
      if (name === 'delete_my_assistant_history') return { data: null, error: null };
      // Solo en el escenario «propietario» la cuenta de demostración es la del propietario.
      if (name === 'owner_access') return { data: { owner: ownerDemo && signedIn }, error: null };
      if (name === 'owner_admin') {
        if (!signedIn) return { data: null, error: { message: 'AUTH_REQUIRED' } };
        if (!ownerDemo) return { data: null, error: { message: 'OWNER_REQUIRED' } };
        return owner.rpc(name, _args);
      }
      // Aviso general (lo pone el propietario desde su panel).
      if (name === 'app_notice') return { data: owner.notice(), error: null };
      return { data: null, error: { message: 'unknown rpc' } };
    },
    functions: { invoke },
    /** Fotos de perfil en memoria (como data: URL, para verlas tanto en el móvil como en la web). */
    storage: {
      from(_bucket: string) {
        return {
          async upload(path: string, body: ArrayBuffer, o?: { contentType?: string }) {
            await delay(300);
            avatars.set(path, `data:${o?.contentType ?? 'image/jpeg'};base64,${toBase64(body)}`);
            return { data: { path }, error: null };
          },
          async createSignedUrl(path: string, _seconds?: number) {
            const url = avatars.get(path);
            return url ? { data: { signedUrl: url }, error: null } : { data: null, error: { message: 'Object not found' } };
          },
          async remove(paths: string[]) {
            paths.forEach((path) => avatars.delete(path));
            return { data: null, error: null };
          },
        };
      },
    },
    /** Acciones propias de la demostración (sin equivalente real). */
    demo: {
      setPremium(value: boolean) {
        setPremium(value);
      },
    },
  };
}

export type DemoBackend = ReturnType<typeof createDemoBackend>;

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Base64 sin depender de btoa (no existe en todos los motores). */
function toBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let out = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += B64[(triple >> 18) & 63] + B64[(triple >> 12) & 63];
    out += i + 1 < bytes.length ? B64[(triple >> 6) & 63] : '=';
    out += i + 2 < bytes.length ? B64[triple & 63] : '=';
  }
  return out;
}
