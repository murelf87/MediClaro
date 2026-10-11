/**
 * «Notifícanos un error» (Ayuda): la persona escribe qué le pasa y llega a la bandeja «Errores notificados» del panel
 * del propietario (función del servidor `report_problem`, migración 20261011160000_problem_reports.sql).
 *
 * Además del mensaje se envían unos datos técnicos para poder arreglarlo (versión, sistema, pantalla, tamaño de letra,
 * formas de pago de esta versión…). NUNCA se envían datos de salud, medicamentos, ubicación ni el nombre del móvil.
 * Funciona con y sin cuenta. El teléfono de contacto es opcional y lo escribe (o deja) la propia persona.
 */
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { supabase, isBackendConfigured, isDemoClientActive } from '../lib/supabase';
import { AppError, toAppError } from '../api/errors';
import { APP_VERSION, PAYMENT_CHANNELS } from '../config/app';

export const REPORT_MIN = 10;
export const REPORT_MAX = 2000;
export const CONTACT_MAX = 120;

export interface ReportContextInput {
  /** Pantalla desde la que se abrió «Notifícanos un error» (p. ej. «/assistant»). */
  screen?: string | null;
  sessionMode?: string | null;
  premium?: boolean;
  fontSize?: string;
  easyMode?: boolean;
  readingVoice?: string;
  assistantVoice?: string;
  /** Vista previa del propietario activa («Ver la app como…»). */
  preview?: string | null;
  /** Últimas pantallas visitadas (solo rutas). */
  screens?: string[];
  /** Qué parte de la app eligió la persona («Voz», «Pagos»…). */
  area?: string | null;
}

function runtime(): 'expo-go' | 'app' | 'web' {
  if (Platform.OS === 'web') return 'web';
  return Constants.executionEnvironment === 'storeClient' ? 'expo-go' : 'app';
}

function timeZone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

/** Datos técnicos que acompañan al mensaje (sin datos personales ni de salud). */
export function buildReportContext(input: ReportContextInput): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {
    appVersion: APP_VERSION,
    runtime: runtime(),
    platform: Platform.OS,
    osVersion: String(Platform.Version ?? ''),
    payments: PAYMENT_CHANNELS.join(',') || 'none',
    sentAt: new Date().toISOString(),
  };
  // Número de compilación real (el de la tienda o de EAS), solo en la app instalada (en Expo Go sería el de Expo Go).
  if (runtime() === 'app' && Application.nativeBuildVersion) out.build = String(Application.nativeBuildVersion);
  const tz = timeZone();
  if (tz) out.timeZone = tz;
  if (input.screen) out.screen = String(input.screen).slice(0, 80);
  if (input.screens?.length) out.screens = input.screens.join(' → ').slice(0, 300);
  if (input.area) out.area = String(input.area).slice(0, 40);
  out.account = input.sessionMode ?? 'none';
  if (input.premium !== undefined) out.premium = input.premium;
  if (input.fontSize) out.fontSize = input.fontSize;
  if (input.easyMode !== undefined) out.easyMode = input.easyMode;
  if (input.readingVoice) out.readingVoice = input.readingVoice;
  if (input.assistantVoice) out.assistantVoice = input.assistantVoice;
  if (input.preview) out.preview = input.preview;
  return out;
}

/** Comprueba el texto antes de enviarlo. Devuelve el mensaje de error para la persona, o null si está bien. */
export function validateReport(message: string, contact: string): string | null {
  const text = message.trim();
  if (text.length < REPORT_MIN) return 'Cuéntanos un poco más qué ha pasado (al menos una frase).';
  if (text.length > REPORT_MAX) return `El mensaje es demasiado largo (máximo ${REPORT_MAX} letras).`;
  if (contact.trim().length > CONTACT_MAX) return 'El teléfono o correo de contacto es demasiado largo.';
  return null;
}

export const ProblemReportService = {
  /** Envía el mensaje. Devuelve la referencia («E-7K2PX») para que la persona pueda citarla. */
  async send(message: string, contact: string, context: ReportContextInput): Promise<{ ref: string }> {
    const invalid = validateReport(message, contact);
    if (invalid) throw new AppError('invalid_input', invalid);
    // Modo demostración: llega a la bandeja de la demostración (en memoria).
    if (!isBackendConfigured && !isDemoClientActive()) {
      throw new AppError('not_configured', 'En esta versión de prueba no se pueden enviar mensajes.');
    }
    const { data, error } = await supabase.rpc('report_problem', {
      p_message: message.trim(),
      p_contact: contact.trim() || null,
      p_context: buildReportContext(context),
    });
    if (error) {
      const text = String(error.message ?? '');
      if (text.includes('RATE_LIMIT')) {
        throw new AppError('rate_limited', 'Has enviado varios mensajes seguidos. Espera un rato y vuelve a intentarlo.');
      }
      if (text.includes('MESSAGE_TOO_SHORT')) throw new AppError('invalid_input', 'Cuéntanos un poco más qué ha pasado.');
      if (text.includes('MESSAGE_TOO_LONG')) throw new AppError('invalid_input', `El mensaje es demasiado largo (máximo ${REPORT_MAX} letras).`);
      if (error.code === 'PGRST202' || error.code === '42883') {
        throw new AppError('not_configured', 'Ahora mismo no podemos recibir mensajes. Inténtalo más tarde.');
      }
      throw toAppError(error);
    }
    const ref = (data as { ref?: unknown } | null)?.ref;
    return { ref: typeof ref === 'string' ? ref : '' };
  },
};
