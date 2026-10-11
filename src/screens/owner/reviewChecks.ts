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
import { configureAudioForSpeech } from '../../utils/audio';
import { applyPlaybackRate } from '../../utils/playbackRate';
import { deviceVoiceQuality, pickDeviceVoice, speakOnDevice } from '../../utils/deviceSpeech';

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

export function isExpoGo(): boolean {
  return Constants.executionEnvironment === 'storeClient';
}

// ── Versión ─────────────────────────────────────────────────────────────────────────────────────────────
export function appInfo(): CheckResult {
  const system = Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web';
  const build = isExpoGo() ? null : Application.nativeBuildVersion;
  const where = isExpoGo() ? 'Expo Go (prueba)' : Platform.OS === 'web' ? 'navegador' : 'app instalada';
  return {
    state: 'info',
    detail: `MediClaro ${APP_VERSION}${build ? ` (build ${build})` : ''} · ${where} · ${system} ${String(Platform.Version ?? '')}`.trim(),
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

export async function checkServerAndPayments(): Promise<{ server: CheckResult; payments: CheckResult }> {
  const started = Date.now();
  try {
    const offer = await PurchaseService.getOffer();
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

/**
 * Pide la voz al servidor y la REPRODUCE como lo hace la app (mismo reproductor y misma velocidad).
 * Se da por buena cuando empieza a sonar; si no suena en 10 s o el reproductor da error, se explica dónde falla.
 */
export async function testNaturalVoice(voice: GeminiVoice): Promise<CheckResult> {
  const started = Date.now();
  let audio: { uri: string; cleanup: () => void };
  try {
    await configureAudioForSpeech();
    audio = await SpeechService.synthesize(NATURAL_SAMPLE, voice, 'reading');
  } catch (e) {
    return { state: 'fail', detail: `El servidor no ha devuelto la voz ${voice} (${seconds(Date.now() - started)}): ${reason(e)}` };
  }
  const prepared = Date.now() - started;
  return new Promise<CheckResult>((resolve) => {
    let settled = false;
    let player: ReturnType<typeof createAudioPlayer> | null = null;
    let subscription: { remove: () => void } | null = null;
    const release = () => {
      try { subscription?.remove(); } catch { /* noop */ }
      try { player?.remove(); } catch { /* noop */ }
      audio.cleanup();
    };
    const settle = (r: CheckResult, releaseNow: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (releaseNow) release();
      resolve(r);
    };
    const timer = setTimeout(
      () => settle({ state: 'fail', detail: `La voz llega del servidor (${seconds(prepared)}), pero el móvil no la reproduce.` }, true),
      10_000,
    );
    try {
      player = createAudioPlayer(audio.uri, { updateInterval: 200 });
      applyPlaybackRate(player, 1);
      subscription = player.addListener('playbackStatusUpdate', (s: AudioStatus) => {
        if (s.error) {
          settle({ state: 'fail', detail: `El reproductor da error: ${String(s.error)}` }, true);
          return;
        }
        if (s.playing) {
          settle({ state: 'ok', detail: `Suena la voz ${voice}. Preparada en ${seconds(prepared)}.` }, false);
        }
        if (s.didJustFinish) release();
      });
      player.play();
    } catch (e) {
      settle({ state: 'fail', detail: `El reproductor no arranca: ${reason(e)}` }, true);
    }
  });
}

// ── Voz del teléfono (respaldo) ─────────────────────────────────────────────────────────────────────────
export async function checkDeviceVoice(): Promise<CheckResult> {
  if (Platform.OS === 'web') return { state: 'info', detail: 'En el navegador se usa la voz del sistema.' };
  const voices = await Speech.getAvailableVoicesAsync().catch(() => [] as Speech.Voice[]);
  const voice = pickDeviceVoice(voices);
  const how =
    Platform.OS === 'ios'
      ? 'En el iPhone: Ajustes → Accesibilidad → Leer y hablar → Voces → Español (España) → descarga «Marisol» o «Mónica» (Premium).'
      : 'En Android: Ajustes → Accesibilidad → Texto a voz → instala los datos de voz en español.';
  if (!voice) return { state: 'warn', detail: `No hay ninguna voz en español de calidad: se usaría la del sistema. ${how}` };
  const quality = deviceVoiceQuality(voice);
  return quality === 'Normal'
    ? { state: 'warn', detail: `${voice.name} (${voice.language}) · calidad normal. Para que suene menos a robot: ${how}` }
    : { state: 'ok', detail: `${voice.name} (${voice.language}) · ${quality}.` };
}

export function sayOnDevice(): void {
  void speakOnDevice('Hola. Esta es la voz del teléfono. MediClaro la usa solo si la voz natural no está disponible.', 0.95, () => true, {}).catch(
    () => undefined,
  );
}

// ── Permisos del teléfono ───────────────────────────────────────────────────────────────────────────────
type Perm = { status?: string; granted?: boolean; canAskAgain?: boolean };

function permState(p: Perm | null, consequence: string): CheckResult {
  if (!p) return { state: 'info', detail: 'No se puede comprobar en este dispositivo.' };
  if (p.granted || p.status === 'granted') return { state: 'ok', detail: 'Permitido.' };
  if (p.status === 'undetermined') return { state: 'warn', detail: `Aún no se ha pedido. ${consequence}` };
  return { state: 'fail', detail: `Denegado. ${consequence}${p.canAskAgain === false ? ' Hay que activarlo en los Ajustes del móvil.' : ''}` };
}

async function safe<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
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
    const always = !!background && (background.granted || background.status === 'granted');
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
    const s = await AccessCodeService.status();
    if (!s.hasCode) return { state: 'warn', detail: 'Tu cuenta aún no tiene código MediClaro. Créalo en Perfil → Mi cuenta.' };
    const since = s.createdAt ? new Date(s.createdAt).toLocaleDateString('es-ES') : null;
    return { state: 'ok', detail: `El servicio funciona y tu cuenta tiene código${since ? ` (desde el ${since})` : ''}.` };
  } catch (e) {
    return { state: 'fail', detail: `El servicio del código no responde: ${reason(e)}` };
  }
}
