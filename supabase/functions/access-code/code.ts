/** Formato del código MediClaro: MC-XXXX-XXXX (8 caracteres sin ambigüedades ≈ 8,5·10^11 combinaciones). */
// Sin letras ni números que se confundan (0/O, 1/I/L).
export const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
export const LENGTH = 8;

/** «mc-4k7p 9x2q» → «4K7P9X2Q»; null si no tiene la forma de un código. */
export function normalizeCode(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  let s = raw.toUpperCase().replace(/[^0-9A-Z]/g, '');
  if (s.startsWith('MC') && s.length === LENGTH + 2) s = s.slice(2);
  if (s.length !== LENGTH) return null;
  for (const ch of s) if (!ALPHABET.includes(ch)) return null;
  return s;
}

export function newCode(): string {
  const out: string[] = [];
  const bytes = new Uint8Array(LENGTH * 2);
  while (out.length < LENGTH) {
    crypto.getRandomValues(bytes);
    for (const b of bytes) {
      if (b < 248 && out.length < LENGTH) out.push(ALPHABET[b % ALPHABET.length]); // 248 = 8 × 31: sin sesgo
    }
  }
  return out.join('');
}

export const pretty = (code: string) => `MC-${code.slice(0, 4)}-${code.slice(4)}`;
