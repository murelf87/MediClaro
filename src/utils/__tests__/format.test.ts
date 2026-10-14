import {
  ageFromDob,
  formatDateShort,
  formatDuration,
  formatPhoneForDisplay,
  formatPrice,
  formatRelativeDay,
  initials,
  toDialable,
  validateNationalPhone,
} from '../format';
import { DEFAULT_PHONE_COUNTRY, findCountryByIso } from '../../config/countries';

describe('formatPrice', () => {
  it('formatea euros con coma decimal', () => {
    expect(formatPrice(499)).toBe('4,99 €');
    expect(formatPrice(8388)).toBe('83,88 €');
    expect(formatPrice(5)).toBe('0,05 €');
    expect(formatPrice(123456)).toBe('1.234,56 €');
  });
});

describe('validateNationalPhone', () => {
  const es = DEFAULT_PHONE_COUNTRY;
  it('acepta móviles españoles y devuelve E.164', () => {
    expect(validateNationalPhone('600 123 456', es)).toEqual({ ok: true, e164: '+34600123456' });
    expect(validateNationalPhone('712345678', es)).toEqual({ ok: true, e164: '+34712345678' });
  });
  it('quita el prefijo si se escribió', () => {
    expect(validateNationalPhone('+34 600 123 456', es)).toEqual({ ok: true, e164: '+34600123456' });
    expect(validateNationalPhone('0034600123456', es)).toEqual({ ok: true, e164: '+34600123456' });
  });
  it('rechaza fijos (no reciben SMS), cortos y largos', () => {
    expect(validateNationalPhone('912345678', es)).toEqual({ ok: false, reason: 'not_mobile' });
    expect(validateNationalPhone('60012', es)).toEqual({ ok: false, reason: 'too_short' });
    expect(validateNationalPhone('6001234567890', es)).toEqual({ ok: false, reason: 'too_long' });
    expect(validateNationalPhone('', es)).toEqual({ ok: false, reason: 'empty' });
  });
  it('otros países', () => {
    expect(validateNationalPhone('912345678', findCountryByIso('PT'))).toEqual({ ok: true, e164: '+351912345678' });
  });
});

describe('teléfonos', () => {
  it('formatea para mostrar', () => {
    expect(formatPhoneForDisplay('+34600123456')).toBe('+34 600 123 456');
    expect(formatPhoneForDisplay('34600123456')).toBe('+34 600 123 456');
  });
  it('prepara para marcar', () => {
    expect(toDialable('+34 600 123 456')).toBe('+34600123456');
    expect(toDialable('112')).toBe('112');
  });
});

describe('fechas', () => {
  const now = new Date(2026, 8, 28, 12, 0);
  it('día relativo', () => {
    expect(formatRelativeDay(new Date(2026, 8, 28, 9).toISOString(), now)).toBe('Hoy');
    expect(formatRelativeDay(new Date(2026, 8, 27, 9).toISOString(), now)).toBe('Ayer');
    expect(formatRelativeDay(new Date(2026, 2, 12, 9).toISOString(), now)).toBe('12 de marzo');
    expect(formatRelativeDay(new Date(2025, 2, 12, 9).toISOString(), now)).toBe('12 de marzo de 2025');
  });
  it('edad y fecha corta', () => {
    expect(ageFromDob('1948-03-12', now)).toBe(78);
    expect(formatDateShort('1948-03-12')).toBe('12/03/1948');
    expect(ageFromDob('', now)).toBeNull();
  });
  it('duración', () => {
    expect(formatDuration(65)).toBe('1:05');
  });
});

describe('initials', () => {
  it('toma nombre y último apellido', () => {
    expect(initials('María García López')).toBe('ML');
    expect(initials('María')).toBe('M');
    expect(initials(null)).toBe('');
  });
});

describe('nextMonthStartLabel', () => {
  it('devuelve el día 1 del mes siguiente, también en diciembre', () => {
    const { nextMonthStartLabel } = jest.requireActual('../format') as typeof import('../format');
    expect(nextMonthStartLabel(new Date(2026, 8, 28))).toBe('1 de octubre');
    expect(nextMonthStartLabel(new Date(2026, 11, 31))).toBe('1 de enero');
  });
});
