/**
 * Formateo en español (determinista en iOS, Android y web, sin depender de Intl).
 */
import { PHONE_COUNTRIES, type PhoneCountry } from '../config/countries';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  // Fechas "YYYY-MM-DD" se interpretan como fecha local (no UTC)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "12 de marzo de 2026" */
export function formatDateLong(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '';
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}

/** Día en que se renuevan los contadores mensuales del plan gratuito: "1 de octubre". */
export function nextMonthStartLabel(now: Date = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  return `1 de ${MONTHS[d.getMonth()]}`;
}

/** "12/03/1948" */
export function formatDateShort(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

/** "14:05" */
export function formatTime(value: string | null | undefined): string {
  const d = parseDate(value);
  if (!d) return '';
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** "Hoy", "Ayer" o "12 de marzo" (con año si no es el actual). */
export function formatRelativeDay(value: string | null | undefined, now: Date = new Date()): string {
  const d = parseDate(value);
  if (!d) return '';
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Ayer';
  const base = `${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} de ${d.getFullYear()}`;
}

/** "hace un momento", "hace 3 min", "hace 2 h", "ayer"... */
export function formatTimeAgo(value: string | null | undefined, now: Date = new Date()): string {
  const d = parseDate(value);
  if (!d) return '';
  const seconds = Math.max(0, Math.round((now.getTime() - d.getTime()) / 1000));
  if (seconds < 60) return 'hace un momento';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return formatRelativeDay(value, now).toLowerCase();
}

/** "1:05" */
export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/** Edad a partir de fecha de nacimiento. */
export function ageFromDob(dob: string | null | undefined, now: Date = new Date()): number | null {
  const d = parseDate(dob);
  if (!d) return null;
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age -= 1;
  return age >= 0 && age < 130 ? age : null;
}

// ─── Dinero ───────────────────────────────────────────────────────────────────

/** 499 → "4,99 €" · 8388 → "83,88 €" */
export function formatPrice(cents: number, currency: 'EUR' = 'EUR'): string {
  const negative = cents < 0;
  const abs = Math.abs(Math.round(cents));
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  const eurosStr = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const symbol = currency === 'EUR' ? '€' : currency;
  return `${negative ? '-' : ''}${eurosStr},${rest} ${symbol}`;
}

// ─── Teléfonos ────────────────────────────────────────────────────────────────

export function onlyDigits(value: string): string {
  return value.replace(/\D+/g, '');
}

export function groupDigits(digits: string, groups: number[] | undefined): string {
  if (!groups || groups.length === 0) return digits;
  const parts: string[] = [];
  let i = 0;
  for (const g of groups) {
    if (i >= digits.length) break;
    parts.push(digits.slice(i, i + g));
    i += g;
  }
  if (i < digits.length) parts.push(digits.slice(i));
  return parts.join(' ');
}

export type PhoneValidation =
  | { ok: true; e164: string }
  | { ok: false; reason: 'empty' | 'too_short' | 'too_long' | 'not_mobile' };

export function validateNationalPhone(rawDigits: string, country: PhoneCountry): PhoneValidation {
  let digits = onlyDigits(rawDigits);
  // Si la persona escribió el prefijo del país delante, lo quitamos
  const cc = onlyDigits(country.dialCode);
  if (digits.length > country.maxDigits && digits.startsWith(cc)) digits = digits.slice(cc.length);
  if (digits.startsWith('00' + cc)) digits = digits.slice(2 + cc.length);
  if (!digits) return { ok: false, reason: 'empty' };
  if (digits.length < country.minDigits) return { ok: false, reason: 'too_short' };
  if (digits.length > country.maxDigits) return { ok: false, reason: 'too_long' };
  if (country.mobilePattern && !country.mobilePattern.test(digits)) return { ok: false, reason: 'not_mobile' };
  return { ok: true, e164: `${country.dialCode}${digits}` };
}

export const PHONE_ERROR_MESSAGES: Record<Exclude<PhoneValidation, { ok: true }>['reason'], string> = {
  empty: 'Escribe tu número de teléfono.',
  too_short: 'Al número le faltan cifras.',
  too_long: 'El número tiene demasiadas cifras.',
  not_mobile: 'Escribe un número de móvil: el código llega por SMS.',
};

/** "+34600123456" → "+34 600 123 456" */
export function formatPhoneForDisplay(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  const plus = trimmed.startsWith('+') ? trimmed : `+${onlyDigits(trimmed)}`;
  const sorted = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const country = sorted.find((c) => plus.startsWith(c.dialCode));
  if (!country) {
    // Número nacional sin prefijo (p. ej. contacto guardado como "600123456")
    const digits = onlyDigits(trimmed);
    return trimmed.startsWith('+') ? trimmed : groupDigits(digits, [3, 3, 3]);
  }
  const national = onlyDigits(plus.slice(country.dialCode.length));
  return `${country.dialCode} ${groupDigits(national, country.groups)}`;
}

/** Número apto para `tel:` (solo dígitos y +). */
export function toDialable(phone: string): string {
  const trimmed = phone.trim();
  const digits = onlyDigits(trimmed);
  return trimmed.startsWith('+') ? `+${digits}` : digits;
}

// ─── Texto ────────────────────────────────────────────────────────────────────

/** Iniciales para avatar: "María García" → "MG" */
export function initials(name: string | null | undefined): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] ?? '' : '';
  return (first + last).toUpperCase();
}

/** Primera letra en mayúscula. */
export function capitalize(value: string | null | undefined): string {
  if (!value) return '';
  return value.charAt(0).toUpperCase() + value.slice(1);
}

/** Saludo según la hora: "Buenos días" / "Buenas tardes" / "Buenas noches". */
export function greetingForHour(hour: number = new Date().getHours()): string {
  if (hour >= 6 && hour < 14) return 'Buenos días';
  if (hour >= 14 && hour < 21) return 'Buenas tardes';
  return 'Buenas noches';
}
