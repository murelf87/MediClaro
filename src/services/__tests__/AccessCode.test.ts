import { formatAccessCodeInput, normalizeAccessCode } from '../AccessCodeService';
import { mapAuthError } from '../AuthService';
import { isPublicRoute } from '../../navigation/routeGuard';

describe('código MediClaro', () => {
  test('acepta el código escrito de cualquier forma', () => {
    expect(normalizeAccessCode('mc-4k7p 9x2q')).toBe('4K7P9X2Q');
    expect(normalizeAccessCode('4K7P9X2Q')).toBe('4K7P9X2Q');
    expect(normalizeAccessCode('MC-4K7P-9X2')).toBeNull();
    expect(normalizeAccessCode('MC-0O1I-9X2Q')).toBeNull();
  });
  test('coloca los guiones mientras se escribe', () => {
    expect(formatAccessCodeInput('4k7p')).toBe('MC-4K7P');
    expect(formatAccessCodeInput('mc4k7p9x')).toBe('MC-4K7P-9X');
    expect(formatAccessCodeInput('MC-4K7P-9X2Q-EXTRA')).toBe('MC-4K7P-9X2Q');
    expect(formatAccessCodeInput('')).toBe('');
  });
  test('«Ya soy Premium» es accesible sin sesión', () => {
    expect(isPublicRoute(['premium-login'])).toBe(true);
  });
  test('un teléfono sin Premium no recibe SMS y se explica por qué', () => {
    const e = mapAuthError({ code: 'otp_disabled', message: 'Signups not allowed for otp' }, 'request');
    expect(e.message).toMatch(/no tiene MediClaro Premium/);
  });
});
