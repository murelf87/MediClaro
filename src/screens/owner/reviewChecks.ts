/**
 * Pruebas del panel «Revisar la app»: comprueban EN ESTE MÓVIL lo que más ha fallado (voz natural, voz del teléfono,
 * planes y pagos, permisos, código MediClaro). Solo leen: no cambian nada en el servidor ni en la cuenta.
 * Cada prueba devuelve un estado (bien / aviso / fallo / información) y una frase clara para el propietario.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import * as Notifications from 'expo-notifications';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';
import { Camera } from 'expo-camera';
import { createAudioPlayer, getRecordingPermissionsAsync, type AudioStatus } from 'expo-audio';
import { APP_VERSION, PAYMENT_CHANNELS } from '../../config/app';
import { AccessCodeService } from '../../services/AccessCodeService';
import { PurchaseService } from '../../services/PurchaseService';
import { SpeechService } from '../../services/SpeechService';
import type { GeminiVoice } from '../../services/PreferencesService';
import { VOICE_PREVIEW_TEXTS } from '../../config/voicePreviews';
import { errorText } from '../../services/VoiceDiagnostics';
import { configureAudioForSpeech, type AudioModeResult } from '../../utils/audio';
import { applyPlaybackRate } from '../../utils/playbackRate';
import { deviceVoiceQuality, hasDeviceVoice, pickDeviceVoice, speakOnDevice } from '../../utils/deviceSpeech';
import { jsVersionLabel } from '../../utils/appUpdate';

export type CheckState = 'ok' | 'warn' | 'fail' | 'info';
export interface CheckResult {
  state: CheckState;
  detail: string;
}

export function seconds(ms: number): string {
  return `${(ms / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
}

function reason(e: unknown): string {
  const m = e instanceof Error ? e.message : typeof e === 'string' ? e : '';
  return m.trim() || 'error desconocido';
}

/** Lo máximo que se espera a una función del sistema en estas pruebas (si no responde, se dice). */
const SYSTEM_WAIT_MS = 5_000;
const NO_RESPONSE = Symbol('sin respuesta');

/** Espera como mucho `ms`; si no hay respuesta devuelve NO_RESPONSE (nunca deja una prueba «comprobando» para siempre). */
async function within<T>(task: () => Promise<T>, ms = SYSTEM_WAIT_MS): Promise<T | typeof NO_RESPONSE> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.resolve().then(task),
      new Promise<typeof NO_RESPONSE>((resolve) => {
        timer = setTimeout(() => resolve(NO_RESPONSE), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

// ── Versión ─────────────────────────────────────────────────────────────────────────────────────────────
export function appInfo(): CheckResult {
  const system = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
  const build = isExpoGo() ? null : Application.nativeBuildVersion;
  const where = isExpoGo() ? 'Expo Go (prueba)' : Platform.OS === 'web' ? 'navegador' : 'app instalada';
  const js = isExpoGo() ? null : jsVersionLabel();
  return {
    state: 'info',
    detail: `MediClaro ${APP_VERSION}${build ? ` (build ${build})` : ''} · ${where} · ${system} ${String(Platform.Version ?? '')}${
      js ? ` · Pantallas: ${js}` : ''
    }`.trim(),
  };
}

// ── Servidor y pagos ────────────────────────────────────────────────────────────────────────────────────
const CHANNEL_NAME: Record<string, string> = {
  store: 'Apple / Google Play',
  card: 'tarjeta',
  bizum: 'Bizum',
  family: 'pago de un familiar',
  sepa: 'domiciliación',
  paypal: 'PayPal',
};

const SERVER_CHECK_MS = 20_000;

export async function checkServerAndPayments(): Promise<{ server: CheckResult; payments: CheckResult }> {
  const started = Date.now();
  try {
    const offer = await within(() => PurchaseService.getOffer(), SERVER_CHECK_MS);
    if (offer === NO_RESPONSE) {
      return {
        server: { state: 'fail', detail: `No responde en ${SERVER_CHECK_MS / 1000} s.` },
        payments: { state: 'fail', detail: 'No se han podido cargar los planes.' },
      };
    }
    const ms = Date.now() - started;
    const server: CheckResult = ms > 5000 ? { state: 'warn', detail: `Responde, pero despacio (${seconds(ms)}).` } : { state: 'ok', detail: `Responde en ${seconds(ms)}.` };
    const sellable = offer.plans.filter((p) => p.channels.length > 0);
    const ways = Array.from(new Set(sellable.flatMap((p) => p.channels))).map((c) => CHANNEL_NAME[c] ?? c);
    const compiled = PAYMENT_CHANNELS.map((c) => CHANNEL_NAME[c] ?? c).join(' y ') || 'ninguna';
    const storeNote =
      PAYMENT_CHANNELS.includes('store') && !offer.catalog.storeVerification
        ? ' Apple / Google Play: el servidor aún no comprueba compras (faltan sus claves), así que no se ofrece.'
        : '';
    if (!sellable.length) {
      return {
        server,
        payments: {
          state: 'fail',
          detail: `En este móvil NO se ve ningún plan para pagar. Formas de pago de esta versión: ${compiled}.${storeNote}`,
        },
      };
    }
    return {
      server,
      payments: {
        state: storeNote ? 'warn' : 'ok',
        detail: `${sellable.length} ${sellable.length === 1 ? 'plan' : 'planes'} a la venta · ${ways.join(', ')}.${storeNote}`,
      },
    };
  } catch (e) {
    return {
      server: { state: 'fail', detail: `No responde (${seconds(Date.now() - started)}): ${reason(e)}` },
      payments: { state: 'fail', detail: 'No se han podido cargar los planes.' },
    };
  }
}

// ── Voz natural (la de la IA y las lecturas) ───────────────────────────────────────────────────────────
const NATURAL_SAMPLE = 'Hola. Soy la voz de MediClaro. Si me oyes bien, la voz natural funciona.';
/** Lo máximo que se espera al servidor en la prueba (después se da por fallida y se explica). */
const SERVER_WAIT_MS = 25_000;
const PLAYER_WAIT_MS = 10_000;

type Fetched = { ok: true; ms: number; audio: { uri: string; cleanup: () => void } } | { ok: false; ms: number; why: string };

async function fetchVoice(load: () => Promise<{ uri: string; cleanup: () => void }>): Promise<Fetched> {
  const started = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let late = false;
  const pending = load();
  try {
    const audio = await Promise.race([
      pending,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          late = true;
          reject(new Error(`no ha respondido en ${Math.round(SERVER_WAIT_MS / 1000)} s`));
        }, SERVER_WAIT_MS);
      }),
    ]);
    return { ok: true, ms: Date.now() - started, audio };
  } catch (e) {
    // Si llega tarde, se borra el audio temporal.
    if (late) void pending.then((a) => a.cleanup()).catch(() => undefined);
    return { ok: false, ms: Date.now() - started, why: errorText(e) };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Reproduce el audio como lo hace la app (mismo reproductor y misma velocidad). Bien = empieza a sonar. */
function playOnce(audio: { uri: string; cleanup: () => void }): Promise<{ ok: true } | { ok: false; why: string }> {
  return new Promise((resolve) => {
    let settled = false;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    let subscription: { remove: () => void } | null = null;
    const release = () => {
      try { subscription?.remove(); } catch { /* noop */ }
      try { player?.remove(); } catch { /* noop */ }
      audio.cleanup();
    };
    const settle = (r: { ok: true } | { ok: false; why: string }, releaseNow: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (releaseNow) release();
      resolve(r);
    };
    const timer = setTimeout(() => settle({ ok: false, why: 'llega del servidor, pero el móvil no la reproduce' }, true), PLAYER_WAIT_MS);
    try {
      player = createAudioPlayer(audio.uri, { updateInterval: 200 });
      applyPlaybackRate(player, 1);
      subscription = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
        if (s.error) {
          settle({ ok: false, why: `el reproductor da error: ${errorText(s.error)}` }, true);
          return;
        }
        if (s.playing) settle({ ok: true }, false);
        if (s.didJustFinish) release();
      });
      player.play();
    } catch (e) {
      settle({ ok: false, why: `el reproductor no arranca: ${errorText(e)}` }, true);
    }
  });
}

function audioModeNote(mode: AudioModeResult): string {
  if (mode === 'timeout') return ' El móvil tardó en preparar el sonido: con el interruptor de silencio puesto puede no oírse.';
  if (mode === 'error') return ' El móvil no dejó preparar el sonido: con el interruptor de silencio puesto puede no oírse.';
  return '';
}

/**
 * Prueba los DOS caminos de la voz natural, a la vez:
 *  - el de «Probar» en Accesibilidad (voz pública de prueba, sin cuenta), y
 *  - el del asistente y las lecturas (con la cuenta).
 * Reproduce la primera voz que llegue (como lo hace la app) y explica, para cada camino, si va bien o dónde falla.
 */
export async function testNaturalVoice(voice: GeminiVoice): Promise<CheckResult> {
  const mode = await configureAudioForSpeech();
  const [preview, reading] = await Promise.all([
    fetchVoice(() => SpeechService.synthesize(VOICE_PREVIEW_TEXTS.assistantTest, voice, 'preview')),
    fetchVoice(() => SpeechService.synthesize(NATURAL_SAMPLE, voice, 'reading')),
  ]);
  const line = (name: string, f: Fetched) => (f.ok ? `${name}: bien (${seconds(f.ms)}).` : `${name}: FALLA (${f.why}).`);
  const paths = `${line('Pruebas de Accesibilidad', preview)} ${line('Asistente y lecturas', reading)}`;
  const chosen = preview.ok ? preview.audio : reading.ok ? reading.audio : null;
  // Solo se reproduce una; la otra se borra.
  if (preview.ok && reading.ok) reading.audio.cleanup();
  if (!chosen) {
    return { state: 'fail', detail: `El servidor no ha devuelto la voz ${voice}. ${paths}${audioModeNote(mode)}` };
  }
  const played = await playOnce(chosen);
  if (!played.ok) {
    return { state: 'fail', detail: `La voz ${voice} no suena: ${played.why}. ${paths}${audioModeNote(mode)}` };
  }
  const allOk = preview.ok && reading.ok && mode !== 'timeout' && mode !== 'error';
  return { state: allOk ? 'ok' : 'warn', detail: `Suena la voz ${voice}. ${paths}${audioModeNote(mode)}` };
}

// ── Voz del teléfono (respaldo) ─────────────────────────────────────────────────────────────────────────
export async function checkDeviceVoice(): Promise<CheckResult> {
  if (Platform.OS === 'web') return { state: 'info', detail: 'En el navegador se usa la voz del sistema.' };
  const voices = await within(() => Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]));
  if (voices === NO_RESPONSE) {
    return {
      state: 'fail',
      detail: `El móvil no ha dado su lista de voces en ${SYSTEM_WAIT_MS / 1000} s. Si pasa siempre, cierra MediClaro del todo y vuelve a abrirla.`,
    };
  }
  const voice = pickDeviceVoice(voices);
  const how =
    Platform.OS === 'ios'
      ? 'En el iPhone: Ajustes → Accesibilidad → Leer y hablar → Voces → Español (España) → descarga voces «Premium» o «Mejorada» (de mujer y de hombre).'
      : 'En Android: Ajustes → Accesibilidad → Texto a voz → instala los datos de voz en español.';
  if (!voice) return { state: 'warn', detail: `No hay ninguna voz en español de calidad: se usaría la del sistema. ${how}` };
  // Cada persona elige voz de mujer o de hombre: qué voz del teléfono le tocaría a cada una en este móvil.
  const female = hasDeviceVoice(voices, 'female') ? pickDeviceVoice(voices, 'female') : undefined;
  const male = hasDeviceVoice(voices, 'male') ? pickDeviceVoice(voices, 'male') : undefined;
  const describe = (v?: Speech.Voice) => (v ? `${v.name} (${deviceVoiceQuality(v).toLowerCase()})` : 'no tiene');
  if (!female && !male) {
    // No se reconoce si son de mujer o de hombre (p. ej. en Android): se usa la mejor.
    const quality = deviceVoiceQuality(voice);
    return quality === 'Normal'
      ? { state: 'warn', detail: `${voice.name} (${voice.language}) · calidad normal. Para que suene menos a robot: ${how}` }
      : { state: 'ok', detail: `${voice.name} (${voice.language}) · ${quality}.` };
  }
  const detail = `Mujer: ${describe(female)} · Hombre: ${describe(male)}.`;
  const weak = !female || !male || deviceVoiceQuality(female) === 'Normal' || deviceVoiceQuality(male) === 'Normal';
  return weak ? { state: 'warn', detail: `${detail} ${how}` } : { state: 'ok', detail };
}

export function sayOnDevice(): void {
  // Primero se prepara el sonido (si no, con el interruptor de silencio puesto no se oye en iPhone).
  void configureAudioForSpeech()
    .then(() =>
      speakOnDevice('Hola. Esta es la voz del teléfono. Cada móvil usa la mejor que tenga en español.', 0.95, () => true, {}),
    )
    .catch(() => undefined);
}

// ── Permisos del teléfono ───────────────────────────────────────────────────────────────────────────────
type Perm = { status?: string; granted?: boolean; canAskAgain?: boolean };

function permState(p: Perm | null | typeof NO_RESPONSE, consequence: string): CheckResult {
  if (p === NO_RESPONSE) return { state: 'fail', detail: `El móvil no responde (más de ${SYSTEM_WAIT_MS / 1000} s).` };
  if (!p) return { state: 'info', detail: 'No se puede comprobar en este dispositivo.' };
  if (p.granted || p.status === 'granted') return { state: 'ok', detail: 'Permitido.' };
  if (p.status === 'undetermined') return { state: 'warn', detail: `Aún no se ha pedido. ${consequence}` };
  return { state: 'fail', detail: `Denegado. ${consequence}${p.canAskAgain === false ? ' Hay que activarlo en los Ajustes del móvil.' : ''}` };
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null | typeof NO_RESPONSE> {
  try {
    return await within(fn);
  } catch {
    return null;
  }
}

export async function checkPermissions(): Promise<{ label: string; result: CheckResult }[]> {
  if (Platform.OS === 'web') return [{ label: 'Permisos del móvil', result: { state: 'info', detail: 'Los permisos se comprueban en el móvil.' } }];
  const [notifications, camera, microphone, foreground, background] = await Promise.all([
    safe(() => Notifications.getPermissionsAsync()),
    safe(() => Camera.getCameraPermissionsAsync()),
    safe(() => getRecordingPermissionsAsync()),
    safe(() => Location.getForegroundPermissionsAsync()),
    safe(() => Location.getBackgroundPermissionsAsync()),
  ]);
  const location = permState(foreground, 'Sin ella no se envía la ubicación al cuidador/a.');
  if (location.state === 'ok') {
    const always = !!background && background !== NO_RESPONSE && (background.granted || background.status === 'granted');
    location.detail = always
      ? 'Permitida, también con el móvil bloqueado.'
      : isExpoGo()
        ? 'Permitida mientras se usa la app (en Expo Go no existe «Siempre»).'
        : 'Permitida mientras se usa la app. Con el móvil bloqueado: no.';
  }
  return [
    { label: 'Permiso de notificaciones', result: permState(notifications, 'No llegarán los avisos de pastillas ni los del cuidador/a.') },
    { label: 'Permiso de cámara', result: permState(camera, 'No se podrán fotografiar medicamentos.') },
    { label: 'Permiso de micrófono', result: permState(microphone, 'No se podrá hablar con el asistente ni llamar al cuidador/a.') },
    { label: 'Permiso de ubicación', result: location },
  ];
}

// ── Código MediClaro ────────────────────────────────────────────────────────────────────────────────────
export async function checkAccessCode(): Promise<CheckResult> {
  try {
    const s = await within(() => AccessCodeService.status(), SERVER_CHECK_MS);
    if (s === NO_RESPONSE) return { state: 'fail', detail: `El servicio del código no responde en ${SERVER_CHECK_MS / 1000} s.` };
    if (!s.hasCode) return { state: 'warn', detail: 'Tu cuenta aún no tiene código MediClaro. Créalo en Perfil → Mi cuenta.' };
    const since = s.createdAt ? new Date(s.createdAt).toLocaleDateString('es-ES') : null;
    return { state: 'ok', detail: `El servicio funciona y tu cuenta tiene código${since ? ` (desde el ${since})` : ''}.` };
  } catch (e) {
    return { state: 'fail', detail: `El servicio del código no responde: ${reason(e)}` };
  }
}
