/**
 * Textos de la bandeja «Errores notificados»: los datos técnicos que acompañan a cada mensaje, en español claro.
 * Funciones puras (probadas en __tests__/reportFormat.test.ts).
 */

type Ctx = Record<string, unknown>;

const str = (c: Ctx, k: string): string | null => {
  const v = c[k];
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number') return String(v);
  return null;
};

const RUNTIME: Record<string, string> = { 'expo-go': 'Expo Go (prueba)', app: 'App instalada', web: 'Navegador' };
const SYSTEM: Record<string, string> = { ios: 'iPhone', android: 'Android', web: 'Web' };
const ACCOUNT: Record<string, string> = {
  none: 'Sin cuenta',
  anonymous: 'Básico (sin teléfono)',
  verified: 'Con teléfono',
  demo: 'Modo demostración',
};
const FONT: Record<string, string> = { normal: 'Normal', grande: 'Grande', muy_grande: 'Muy grande' };
const PREVIEW: Record<string, string> = { visitor: 'Sin cuenta', free: 'Básico', premium: 'Premium', caregiver: 'Cuidador/a' };
const PAYMENTS: Record<string, string> = { store: 'Apple/Google', card: 'tarjeta', none: 'ninguna' };

/** «iPhone · iOS 18.1 · 1.0.0 (build 35)» — para la lista. */
export function reportPlace(c: Ctx | null | undefined): string {
  if (!c) return '';
  const platform = str(c, 'platform');
  const version = str(c, 'appVersion');
  const build = str(c, 'build');
  const runtime = str(c, 'runtime');
  return [
    platform ? SYSTEM[platform] ?? platform : null,
    version ? `v${version}${build ? ` (build ${build})` : ''}` : null,
    runtime === 'expo-go' ? 'Expo Go' : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** Todos los datos técnicos, con nombre en español (para la ficha del mensaje). */
export function reportFacts(c: Ctx | null | undefined): { label: string; value: string }[] {
  if (!c) return [];
  const out: { label: string; value: string }[] = [];
  const add = (label: string, value: string | null | undefined) => {
    if (value) out.push({ label, value });
  };
  const platform = str(c, 'platform');
  add('Parte de la app', str(c, 'area'));
  add('Pantalla anterior', str(c, 'screen'));
  add('Últimas pantallas', str(c, 'screens'));
  add('Versión de MediClaro', [str(c, 'appVersion'), str(c, 'build') ? `build ${str(c, 'build')}` : null].filter(Boolean).join(' · ') || null);
  const js = str(c, 'js');
  add('Pantallas', js ? (js === 'build' ? 'las de la build' : `actualización ${js}`) : null);
  const runtime = str(c, 'runtime');
  add('Dónde', runtime ? RUNTIME[runtime] ?? runtime : null);
  const os = str(c, 'osVersion');
  const osText = !os || platform === 'web' ? null : platform === 'ios' ? `iOS ${os}` : platform === 'android' ? `API ${os}` : os;
  add('Sistema', platform ? [SYSTEM[platform] ?? platform, osText].filter(Boolean).join(' · ') : null);
  const account = str(c, 'account');
  add('Cuenta', account ? ACCOUNT[account] ?? account : null);
  if (typeof c.premium === 'boolean') add('Premium', c.premium ? 'Sí' : 'No');
  const font = str(c, 'fontSize');
  add('Tamaño de letra', font ? FONT[font] ?? font : null);
  if (typeof c.easyMode === 'boolean') add('Modo fácil', c.easyMode ? 'Activado' : 'No');
  add('Voz de lectura', str(c, 'readingVoice'));
  add('Voz del asistente', str(c, 'assistantVoice'));
  const payments = str(c, 'payments');
  add('Pagos en esta versión', payments ? payments.split(',').map((p) => PAYMENTS[p] ?? p).join(' y ') : null);
  const preview = str(c, 'preview');
  add('Vista previa del propietario', preview ? PREVIEW[preview] ?? preview : null);
  add('Zona horaria', str(c, 'timeZone'));
  return out;
}

/** Cómo contestar: llamar (teléfono) o escribir (correo). null si no se reconoce. */
export function contactAction(contact: string | null | undefined): { kind: 'tel' | 'mail'; url: string; label: string } | null {
  const text = (contact ?? '').trim();
  if (!text) return null;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(text)) return { kind: 'mail', url: `mailto:${text}`, label: `Escribir a ${text}` };
  const digits = text.replace(/[^\d+]/g, '');
  const plain = digits.replace(/^\+/, '');
  if (/^\d{9,15}$/.test(plain) && /^[\d\s+().-]+$/.test(text)) {
    return { kind: 'tel', url: `tel:${digits}`, label: `Llamar al ${text}` };
  }
  return null;
}
