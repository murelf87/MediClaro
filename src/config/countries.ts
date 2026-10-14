/**
 * Prefijos telefónicos para el login por SMS. España (+34) por defecto.
 */
export interface PhoneCountry {
  iso: string;
  name: string;
  dialCode: string;
  flag: string;
  /** Dígitos nacionales (sin prefijo): mínimo y máximo. */
  minDigits: number;
  maxDigits: number;
  /** Validación adicional de móvil (solo los móviles reciben SMS). */
  mobilePattern?: RegExp;
  /** Agrupación visual de dígitos, p. ej. [3, 3, 3] → "600 123 456". */
  groups?: number[];
}

export const PHONE_COUNTRIES: PhoneCountry[] = [
  { iso: 'ES', name: 'España', dialCode: '+34', flag: '🇪🇸', minDigits: 9, maxDigits: 9, mobilePattern: /^[67]\d{8}$/, groups: [3, 3, 3] },
  { iso: 'PT', name: 'Portugal', dialCode: '+351', flag: '🇵🇹', minDigits: 9, maxDigits: 9, mobilePattern: /^9\d{8}$/, groups: [3, 3, 3] },
  { iso: 'FR', name: 'Francia', dialCode: '+33', flag: '🇫🇷', minDigits: 9, maxDigits: 9, mobilePattern: /^[67]\d{8}$/, groups: [1, 2, 2, 2, 2] },
  { iso: 'IT', name: 'Italia', dialCode: '+39', flag: '🇮🇹', minDigits: 9, maxDigits: 10, mobilePattern: /^3\d{8,9}$/, groups: [3, 3, 4] },
  { iso: 'DE', name: 'Alemania', dialCode: '+49', flag: '🇩🇪', minDigits: 10, maxDigits: 11, mobilePattern: /^1[5-7]\d{8,9}$/, groups: [4, 7] },
  { iso: 'GB', name: 'Reino Unido', dialCode: '+44', flag: '🇬🇧', minDigits: 10, maxDigits: 10, mobilePattern: /^7\d{9}$/, groups: [4, 6] },
  { iso: 'IE', name: 'Irlanda', dialCode: '+353', flag: '🇮🇪', minDigits: 9, maxDigits: 9, mobilePattern: /^8\d{8}$/, groups: [2, 3, 4] },
  { iso: 'AD', name: 'Andorra', dialCode: '+376', flag: '🇦🇩', minDigits: 6, maxDigits: 6, groups: [3, 3] },
  { iso: 'CH', name: 'Suiza', dialCode: '+41', flag: '🇨🇭', minDigits: 9, maxDigits: 9, mobilePattern: /^7\d{8}$/, groups: [2, 3, 2, 2] },
  { iso: 'BE', name: 'Bélgica', dialCode: '+32', flag: '🇧🇪', minDigits: 9, maxDigits: 9, mobilePattern: /^4\d{8}$/, groups: [3, 2, 2, 2] },
  { iso: 'NL', name: 'Países Bajos', dialCode: '+31', flag: '🇳🇱', minDigits: 9, maxDigits: 9, mobilePattern: /^6\d{8}$/, groups: [1, 4, 4] },
  { iso: 'RO', name: 'Rumanía', dialCode: '+40', flag: '🇷🇴', minDigits: 9, maxDigits: 9, mobilePattern: /^7\d{8}$/, groups: [3, 3, 3] },
  { iso: 'MA', name: 'Marruecos', dialCode: '+212', flag: '🇲🇦', minDigits: 9, maxDigits: 9, mobilePattern: /^[67]\d{8}$/, groups: [3, 3, 3] },
  { iso: 'MX', name: 'México', dialCode: '+52', flag: '🇲🇽', minDigits: 10, maxDigits: 10, groups: [2, 4, 4] },
  { iso: 'AR', name: 'Argentina', dialCode: '+54', flag: '🇦🇷', minDigits: 10, maxDigits: 11, groups: [2, 4, 4] },
  { iso: 'CO', name: 'Colombia', dialCode: '+57', flag: '🇨🇴', minDigits: 10, maxDigits: 10, mobilePattern: /^3\d{9}$/, groups: [3, 3, 4] },
  { iso: 'VE', name: 'Venezuela', dialCode: '+58', flag: '🇻🇪', minDigits: 10, maxDigits: 10, groups: [3, 3, 4] },
  { iso: 'EC', name: 'Ecuador', dialCode: '+593', flag: '🇪🇨', minDigits: 9, maxDigits: 9, mobilePattern: /^9\d{8}$/, groups: [2, 3, 4] },
  { iso: 'PE', name: 'Perú', dialCode: '+51', flag: '🇵🇪', minDigits: 9, maxDigits: 9, mobilePattern: /^9\d{8}$/, groups: [3, 3, 3] },
  { iso: 'CL', name: 'Chile', dialCode: '+56', flag: '🇨🇱', minDigits: 9, maxDigits: 9, mobilePattern: /^9\d{8}$/, groups: [1, 4, 4] },
  { iso: 'US', name: 'Estados Unidos', dialCode: '+1', flag: '🇺🇸', minDigits: 10, maxDigits: 10, groups: [3, 3, 4] },
];

export const DEFAULT_PHONE_COUNTRY: PhoneCountry = PHONE_COUNTRIES[0];

export function findCountryByIso(iso: string): PhoneCountry {
  return PHONE_COUNTRIES.find((c) => c.iso === iso) ?? DEFAULT_PHONE_COUNTRY;
}
