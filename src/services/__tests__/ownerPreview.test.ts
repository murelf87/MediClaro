/**
 * «Revisar la app → Ver la app como…»: la vista previa solo cambia lo que ENSEÑAN las pantallas (sesión y Premium
 * que leen useSession/useEntitlement); nunca la cuenta real.
 */
import { OwnerPreview, PREVIEW_LABEL, previewEntitlement, previewSession } from '../OwnerPreview';
import { RecentScreens } from '../RecentScreens';

const realSession = {
  status: 'signedIn' as const,
  session: { userId: 'owner-1', phone: '+34680127015', email: null, mode: 'verified' as const },
  signOut: async () => undefined,
};
const realEntitlement = {
  status: 'ready' as const,
  subscription: { isPremium: true, plan: 'owner' },
  isPremium: true,
  required: true,
  canSell: true,
  unlocked: true,
  refresh: async () => null,
};

afterEach(() => OwnerPreview.clear());

describe('estado de la vista previa', () => {
  test('entrar, cambiar y salir avisa a las pantallas', () => {
    const changes = jest.fn();
    const off = OwnerPreview.subscribe(changes);
    expect(OwnerPreview.isActive()).toBe(false);
    OwnerPreview.set('free');
    OwnerPreview.set('free'); // repetir no vuelve a avisar
    expect(OwnerPreview.get()).toBe('free');
    OwnerPreview.set('caregiver');
    OwnerPreview.clear();
    OwnerPreview.clear();
    expect(changes).toHaveBeenCalledTimes(3);
    expect(OwnerPreview.isActive()).toBe(false);
    off();
  });
  test('etiquetas en español', () => {
    expect(PREVIEW_LABEL).toEqual({ visitor: 'Sin cuenta', free: 'Básico (gratis)', premium: 'Premium', caregiver: 'Cuidador/a' });
  });
  test('rol de cuidado y Premium que se enseñan', () => {
    expect(OwnerPreview.caregiverOverride()).toBeNull();
    expect(OwnerPreview.premiumOverride()).toBeNull();
    OwnerPreview.set('caregiver');
    expect(OwnerPreview.caregiverOverride()).toBe(true);
    expect(OwnerPreview.premiumOverride()).toBe(false);
    OwnerPreview.set('premium');
    expect(OwnerPreview.caregiverOverride()).toBe(false);
    expect(OwnerPreview.premiumOverride()).toBe(true);
  });
});

describe('sesión que ven las pantallas', () => {
  test('sin vista previa (o como Premium) es la real, el mismo objeto', () => {
    expect(previewSession(realSession, null)).toBe(realSession);
    expect(previewSession(realSession, 'premium')).toBe(realSession);
  });
  test('«Sin cuenta»: como si no hubiera sesión', () => {
    expect(previewSession(realSession, 'visitor')).toMatchObject({ status: 'signedOut', session: null });
    // Mientras la sesión real aún carga, se sigue esperando (no se manda a la bienvenida antes de tiempo).
    expect(previewSession({ ...realSession, status: 'loading' as const, session: null }, 'visitor').status).toBe('loading');
  });
  test('Básico y cuidador/a: cuenta sin teléfono (el teléfono solo se registra al pagar Premium)', () => {
    for (const role of ['free', 'caregiver'] as const) {
      const v = previewSession(realSession, role);
      expect(v.status).toBe('signedIn');
      expect(v.session).toMatchObject({ userId: 'owner-1', mode: 'anonymous', phone: null });
    }
    // La sesión real no se toca.
    expect(realSession.session).toMatchObject({ mode: 'verified', phone: '+34680127015' });
  });
});

describe('Premium que ven las pantallas', () => {
  test('sin vista previa es el real', () => {
    expect(previewEntitlement(realEntitlement, null)).toBe(realEntitlement);
  });
  test('sin cuenta, Básico y cuidador/a: sin Premium ni suscripción', () => {
    for (const role of ['visitor', 'free', 'caregiver'] as const) {
      expect(previewEntitlement(realEntitlement, role)).toMatchObject({ status: 'ready', subscription: null, isPremium: false, unlocked: false });
    }
    // Si la app no exige Premium, sigue desbloqueada (como para cualquiera).
    expect(previewEntitlement({ ...realEntitlement, required: false }, 'free').unlocked).toBe(true);
  });
  test('Premium: todo desbloqueado', () => {
    const notPremium = { ...realEntitlement, isPremium: false, unlocked: false, subscription: null };
    expect(previewEntitlement(notPremium, 'premium')).toMatchObject({ isPremium: true, unlocked: true });
  });
});

describe('últimas pantallas (para «Notifícanos un error»)', () => {
  beforeEach(() => RecentScreens.clear());
  test('guarda solo las 6 últimas, sin repetir seguidas y con nombres limpios', () => {
    ['/(tabs)/index', '/(tabs)/index', '/assistant', '/medication/[id]', '/help', '/report-problem'].forEach((p) => RecentScreens.note(p));
    expect(RecentScreens.list()).toEqual(['/', '/assistant', '/medication/[id]', '/help', '/report-problem']);
    expect(RecentScreens.before('/help', '/report-problem')).toBe('/medication/[id]');
    for (let i = 0; i < 10; i += 1) RecentScreens.note(`/p${i}`);
    expect(RecentScreens.list()).toHaveLength(6);
    expect(RecentScreens.list().at(-1)).toBe('/p9');
  });
});
