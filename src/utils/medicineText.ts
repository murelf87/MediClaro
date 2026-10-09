/**
 * Presentación legible de los textos oficiales de medicamentos.
 * CIMA devuelve los nombres en MAYÚSCULAS ("PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG").
 * Para personas mayores es más legible en tipo oración, respetando unidades y siglas.
 * Solo afecta a la visualización: el nombre oficial no se modifica.
 */

const ACRONYMS = new Set([
  'EFG', 'UI', 'IU', 'SL', 'CR', 'XR', 'SR', 'EC', 'LP', 'HCT', 'DPI', 'VIH', 'HIV', 'AAS', 'OTC',
  'B1', 'B2', 'B6', 'B12', 'D3', 'K2', 'C', 'E', 'NF', 'ODT', 'ER', 'XL', 'MR', 'DR', 'TTS', 'PR', 'CFC',
]);

const UNITS = new Set([
  'g', 'mg', 'mcg', 'µg', 'ug', 'ml', 'l', 'ui', 'mmol', 'meq', 'kg', 'mg/ml', 'mg/g', 'g/ml', 'mcg/ml',
  'mg/5ml', 'mg/dosis', 'mcg/dosis', 'ui/ml', 'mg/h', 'mcg/h', '%', 'h',
]);

const LOWER_WORDS = new Set(['de', 'del', 'con', 'en', 'y', 'e', 'o', 'para', 'por', 'sin', 'la', 'el', 'los', 'las', 'a', 'al']);

function isMostlyUpper(text: string): boolean {
  const letters = text.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/g, '');
  if (letters.length < 3) return false;
  const upper = letters.replace(/[^A-ZÁÉÍÓÚÜÑ]/g, '').length;
  return upper / letters.length > 0.8;
}

function formatToken(token: string, index: number): string {
  if (!token) return token;
  // Siglas con puntos: "S.A.", "S.L.", "S.A.U."
  if (/^([A-ZÁÉÍÓÚÑ]\.)+,?$/.test(token)) return token;
  const lower = token.toLowerCase();
  const bare = lower.replace(/[(),.;:]/g, '');
  if (UNITS.has(bare)) return lower;
  if (ACRONYMS.has(token.replace(/[(),.;:]/g, '').toUpperCase()) && token.replace(/[(),.;:]/g, '').length <= 4) {
    return token.toUpperCase();
  }
  if (/\d/.test(token)) return lower; // "1g", "20mg/ml"
  if (index > 0 && LOWER_WORDS.has(bare)) return lower;
  // Palabras con guion o barra: capitalizar cada parte
  return lower.replace(/(^|[-/(])([a-záéíóúüñ])/g, (_m, sep: string, ch: string) => sep + ch.toUpperCase());
}

const NBSP = '\u00A0';

/**
 * Une la cifra con su unidad mediante un espacio de no separación ("1 g", "600 mg", "5 %"),
 * para que con letra grande nunca se parta en dos líneas ("Paracetamol 1 / g").
 */
export function keepDoseTogether(text: string): string {
  return text.replace(
    /(\d(?:[.,]\d+)?) (?=(?:mg|g|mcg|µg|ug|ml|l|ui|UI|mmol|meq|kg|h|%)(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ]))/g,
    `$1${NBSP}`,
  );
}

/** "PARACETAMOL KERN PHARMA 1 G COMPRIMIDOS EFG" → "Paracetamol Kern Pharma 1 g Comprimidos EFG" */
export function prettifyMedicineName(name: string | null | undefined): string {
  if (!name) return '';
  const clean = name.replace(/\s+/g, ' ').trim();
  if (!isMostlyUpper(clean)) return keepDoseTogether(clean);
  return keepDoseTogether(clean.split(' ').map(formatToken).join(' '));
}

/** "COMPRIMIDO RECUBIERTO CON PELÍCULA" → "Comprimido recubierto con película" */
export function prettifySentence(text: string | null | undefined): string {
  if (!text) return '';
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!isMostlyUpper(clean)) return clean;
  const lower = clean.toLowerCase().replace(/\befg\b/g, 'EFG');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function fold(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

/**
 * Nombre corto para listas y títulos: principio activo (o marca) + dosis.
 *   "Paracetamol Kern Pharma 1 g Comprimidos EFG" + "Paracetamol" → "Paracetamol 1 g"
 *   "Ibuprofeno Cinfa 600 mg Comprimidos…"                       → "Ibuprofeno 600 mg"
 *   "Adiro 100 mg Comprimidos Gastrorresistentes"                 → "Adiro 100 mg"
 * Si no se reconoce la dosis, devuelve el nombre completo.
 * El nombre oficial completo se sigue mostrando donde hay que comprobarlo con la caja.
 */
export function shortMedicineName(officialName: string | null | undefined, activeIngredient?: string | null): string {
  const full = (officialName ?? '').replace(/\s+/g, ' ').trim();
  if (!full) return '';
  const tokens = full.split(' ');
  const doseIdx = tokens.findIndex((t, i) => i > 0 && /\d/.test(t));
  if (doseIdx <= 0) return keepDoseTogether(full);

  // Dosis: cifras y unidades seguidas ("1 g", "500 mg/30 mg", "20 mg/ml")
  const dose: string[] = [];
  for (let i = doseIdx; i < tokens.length; i += 1) {
    const t = tokens[i];
    const bare = t.toLowerCase().replace(/[(),;:]/g, '');
    if (/\d/.test(t) || UNITS.has(bare) || /^(mg|g|mcg|ml|ui)\//.test(bare)) dose.push(t);
    else break;
  }
  if (dose.length === 0) return keepDoseTogether(full);

  // Base: el principio activo si el nombre empieza por él; si no, la primera palabra (marca)
  let base = tokens[0];
  if (activeIngredient) {
    const ingredientWords = activeIngredient.replace(/\s+/g, ' ').trim().split(' ');
    const n = ingredientWords.length;
    const start = tokens.slice(0, n).join(' ');
    if (n > 0 && n < doseIdx && fold(start) === fold(ingredientWords.join(' '))) base = start;
    else if (fold(tokens[0]) === fold(ingredientWords[0] ?? '')) base = tokens[0];
  }
  const result = `${base} ${dose.join(' ')}`.trim();
  return keepDoseTogether(result.length < full.length ? result : full);
}
