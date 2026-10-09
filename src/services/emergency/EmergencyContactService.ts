/**
 * MediClaro — EmergencyContactService
 * Notificación al contacto de emergencia mediante SMS.
 *
 * LIMITACIÓN TÉCNICA:
 * iOS y Android no permiten enviar SMS programáticos sin permisos especiales.
 * Se usa Linking.openURL('sms:...') que abre el compositor nativo.
 * El usuario confirma el envío — no se puede enviar en segundo plano.
 *
 * PRIVACIDAD:
 * - La información médica completa NUNCA se envía sin consentimiento específico.
 * - Solo se incluye ubicación si consent_share_location es true.
 */

import { Linking, Platform } from 'react-native';
import { EmergencyConfig, EmergencyReport, AssistanceCallOutcome } from './types';

export interface ContactNotificationResult {
  ok: boolean;
  method: 'sms' | 'unavailable';
  message?: string;
}

/**
 * Construye el mensaje SMS para el contacto de emergencia.
 * NUNCA incluye información médica completa — solo lo esencial.
 */
export function buildContactMessage(report: EmergencyReport, userName?: string): string {
  const name = userName ?? report.user.fullName ?? 'El usuario';
  const time = new Date(report.createdAt).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });

  const lines: string[] = [];
  lines.push(`${name} ha activado el asistente de emergencia de MediClaro a las ${time}.`);

  // Ubicación solo si hay consentimiento
  if (report.consent.shareLocation && report.currentLocation) {
    const loc = report.currentLocation;
    const parts: string[] = [];
    if (loc.resolvedAddress) parts.push(loc.resolvedAddress);
    if (loc.resolvedCity) parts.push(loc.resolvedCity);
    if (parts.length > 0) {
      const approx = loc.isApproximate ? ' (aproximada)' : '';
      lines.push(`Ubicación${approx}: ${parts.join(', ')}.`);
    } else {
      lines.push(`Ubicación (coordenadas): ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}.`);
    }
    lines.push(`Ver en el mapa: https://maps.google.com/?q=${loc.latitude.toFixed(5)},${loc.longitude.toFixed(5)}`);
  } else if (report.consent.shareAddress && report.registeredAddress) {
    const addr = report.registeredAddress;
    lines.push(`Dirección declarada: ${addr.street}, ${addr.city}.`);
  }

  lines.push('Por favor, contacta con él/ella o llama al 112 si es necesario.');
  lines.push('— Asistente de emergencias MediClaro');

  return lines.join('\n');
}

/**
 * Abre el compositor SMS nativo con el mensaje prellenado.
 * LIMITACIÓN: requiere confirmación del usuario en iOS/Android.
 */
export async function notifyEmergencyContact(
  report: EmergencyReport,
): Promise<ContactNotificationResult> {
  if (!report.emergencyContact?.phone) {
    return {
      ok: false,
      method: 'unavailable',
      message: 'No hay contacto de emergencia configurado',
    };
  }

  if (!report.consent.notifyEmergencyContact) {
    return {
      ok: false,
      method: 'unavailable',
      message: 'El usuario no ha autorizado la notificación al contacto',
    };
  }

  const phone = report.emergencyContact.phone.replace(/\s+/g, '');
  const message = buildContactMessage(report, report.user.fullName);

  // Formato de URL de SMS difiere entre iOS y Android
  const smsUrl = Platform.select({
    ios:     `sms:${phone}&body=${encodeURIComponent(message)}`,
    android: `sms:${phone}?body=${encodeURIComponent(message)}`,
    default: `sms:${phone}?body=${encodeURIComponent(message)}`,
  });

  try {
    const canOpen = await Linking.canOpenURL(smsUrl);
    if (!canOpen) {
      return {
        ok: false,
        method: 'unavailable',
        message: 'No se puede abrir la aplicación de mensajes en este dispositivo',
      };
    }

    await Linking.openURL(smsUrl);
    return { ok: true, method: 'sms' };
  } catch (e) {
    return {
      ok: false,
      method: 'unavailable',
      message: String((e as { message?: string } | null)?.message ?? 'Error al abrir mensajes'),
    };
  }
}

// ─── Marcador interno ─────────────────────────────────────────────────────────

/**
 * Abre el marcador del sistema para un número de teléfono arbitrario.
 * Función interna — usar callPrimaryAssistance() o callOfficialEmergency() externamente.
 */
async function _dialNumber(number: string): Promise<boolean> {
  const telUrl = `tel:${number}`;
  // En una emergencia SIEMPRE se intenta abrir el marcador, aunque canOpenURL
  // responda false (en Android 11+ puede hacerlo si falta <queries> en el manifiesto,
  // y en simuladores). Solo se informa de fallo si openURL falla de verdad.
  try {
    await Linking.openURL(telUrl);
    return true;
  } catch {
    return false;
  }
}

// ─── Asistencia principal (configurable) ──────────────────────────────────────

/**
 * Llama al número de asistencia principal definido en la configuración remota.
 *
 * Retorna un AssistanceCallOutcome que describe el resultado.
 * NUNCA llama automáticamente al número oficial de emergencias si falla.
 * La decisión de llamar al 112 pertenece exclusivamente al usuario.
 *
 * @param config  Configuración de emergencia activa (de EmergencyConfigService)
 */
export async function callPrimaryAssistance(
  config: EmergencyConfig,
): Promise<AssistanceCallOutcome> {
  const number = config.primaryAssistanceNumber?.trim();

  if (!number) {
    return 'not_configured';
  }

  try {
    const ok = await _dialNumber(number);
    return ok ? 'success' : 'failed';
  } catch {
    return 'error';
  }
}

// ─── Emergencias oficiales (siempre disponible) ───────────────────────────────

/**
 * Llama al número oficial de emergencias del país.
 * ESTE FLUJO NUNCA PUEDE ESTAR BLOQUEADO POR SUSCRIPCIÓN, IA, O BACKEND.
 * El usuario siempre puede acceder a él, independientemente de si el número
 * principal falló o no está configurado.
 *
 * @param countryEmergencyNumber  Número del servicio oficial (ej: '112'). Por defecto '112'.
 */
export async function callOfficialEmergency(
  countryEmergencyNumber = '112',
): Promise<boolean> {
  // Salvaguarda: nunca puede estar vacío
  const number = countryEmergencyNumber?.trim() || '112';
  return _dialNumber(number);
}

/**
 * @deprecated Usar callPrimaryAssistance() o callOfficialEmergency() en su lugar.
 * Mantenida por compatibilidad con código existente.
 */
export async function dialEmergencyNumber(number = '112'): Promise<boolean> {
  return _dialNumber(number);
}

/** ¿Hay un contacto de emergencia configurado y con consentimiento? */
export function canNotifyContact(report: EmergencyReport): boolean {
  return Boolean(
    report.emergencyContact?.phone &&
    report.consent.notifyEmergencyContact,
  );
}
