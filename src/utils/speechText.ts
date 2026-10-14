/**
 * Texto preparado para la VOZ NATURAL (Sulafat · Achird).
 *
 * El texto que se ve en pantalla no cambia: solo se ajusta lo que se envía a la voz, para que una persona
 * mayor oiga «quinientos miligramos cada ocho horas» y no «quinientos eme ge ce barra ocho hache».
 *  - Unidades junto a una cifra: mg, g, mcg/µg, ml, UI, h, min, %, mmol, mEq y combinadas (mg/ml, mg/5 ml).
 *  - «c/8 h» → «cada 8 horas»; rangos «6-8 horas» → «6 a 8 horas».
 *  - El 112 se dice como en España («uno, uno, dos») SOLO cuando se habla del teléfono de emergencias
 *    («llama al 112»); una dosis como «Eutirox 112 microgramos» no se toca.
 *  - Restos de formato (asteriscos, almohadillas, viñetas) fuera.
 * Es idempotente: aplicarla dos veces da el mismo resultado.
 * Sin lookbehind ni \p{…}: funciona igual en Hermes (iPhone/Android) que en las pruebas.
 */

const LETTERS = 'A-Za-zÁÉÍÓÚÜÑáéíóúüñ';
/** Lo que puede ir justo antes de una cifra para que sea una cantidad (no parte de «B12» o de «x2»). */
const LEFT = `(^|[^${LETTERS}\\d.,])`;
const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
/** Después de la unidad no puede seguir una letra ni una cifra («5 mgx» no es una unidad; «8 horas» ya está). */
const UNIT_END = `(?![${LETTERS}\\d])`;

/** Unidad → [singular, plural]. Claves en minúsculas. */
const UNIT_WORDS: Record<string, [string, string]> = {
  mg: ['miligramo', 'miligramos'],
  g: ['gramo', 'gramos'],
  gr: ['gramo', 'gramos'],
  mcg: ['microgramo', 'microgramos'],
  'µg': ['microgramo', 'microgramos'],
  'μg': ['microgramo', 'microgramos'],
  ug: ['microgramo', 'microgramos'],
  kg: ['kilo', 'kilos'],
  ml: ['mililitro', 'mililitros'],
  l: ['litro', 'litros'],
  ui: ['unidad internacional', 'unidades internacionales'],
  mmol: ['milimol', 'milimoles'],
  meq: ['miliequivalente', 'miliequivalentes'],
  h: ['hora', 'horas'],
  min: ['minuto', 'minutos'],
};

const UNIT_ALT = Object.keys(UNIT_WORDS)
  .sort((a, b) => b.length - a.length)
  .join('|');

const DOSE_WORDS = 'miligramo|microgramo|gramo|mililitro|unidad|comprimido|cápsula|capsula|sobre|gota|dosis';

function unitWord(unit: string, num: string): string {
  const words = UNIT_WORDS[unit.toLowerCase()];
  if (!words) return unit;
  return num === '1' ? words[0] : words[1];
}

/** «100 mg/ml» → «100 miligramos por mililitro»; «250 mg/5 ml» → «250 miligramos por cada 5 mililitros». */
function expandCompositeUnits(text: string): string {
  const re = new RegExp(`${LEFT}${NUMBER}\\s?(${UNIT_ALT})\\s?\\/\\s?(?:(\\d+(?:[.,]\\d+)?)\\s?)?(${UNIT_ALT})${UNIT_END}`, 'gi');
  return text.replace(re, (_m, left: string, num: string, unit: string, perNum: string | undefined, perUnit: string) => {
    const first = `${num} ${unitWord(unit, num)}`;
    if (perNum) return `${left}${first} por cada ${perNum} ${unitWord(perUnit, perNum)}`;
    return `${left}${first} por ${unitWord(perUnit, '1')}`;
  });
}

function expandSimpleUnits(text: string): string {
  const re = new RegExp(`${LEFT}${NUMBER}(\\s?)(${UNIT_ALT})${UNIT_END}`, 'gi');
  return text.replace(re, (match, left: string, num: string, space: string, unit: string) => {
    // «2 l» sí; «2l» suele ser una errata o parte de un código: no se toca.
    if (unit.toLowerCase() === 'l' && !space) return match;
    return `${left}${num} ${unitWord(unit, num)}`;
  });
}

const EMERGENCY_CONTEXT = 'al|el|del|número|numero|teléfono|telefono|marca|marcar|marque|llama|llamar|llame|llamad|emergencias';

function sayEmergencyNumbers(text: string): string {
  const notDose = `(?!\\s?(?:${UNIT_ALT}|${DOSE_WORDS}))`;
  return text
    .replace(
      new RegExp(`(^|[^${LETTERS}\\d])(${EMERGENCY_CONTEXT})(\\s+)112(?!\\d|[.,]\\d)${notDose}`, 'gi'),
      '$1$2$3uno, uno, dos',
    )
    .replace(/\(112\)/g, '(uno, uno, dos)')
    .replace(new RegExp(`(^|[^${LETTERS}\\d])(${EMERGENCY_CONTEXT})(\\s+)024(?!\\d|[.,]\\d)`, 'gi'), '$1$2$3cero, dos, cuatro');
}

/**
 * Restos de Markdown o de listas que la voz leería en voz alta. Cada línea de una lista termina con una pausa,
 * para que «Bebe agua» y «Consulta a tu médico» no se lean pegados.
 */
function stripFormatting(text: string): string {
  const lines = text
    .replace(/\*\*|__|`+/g, '')
    .split('\n')
    .map((line) =>
      line
        .replace(/^[ \t]{0,3}#{1,6}[ \t]+/, '')
        .replace(/^[ \t]*[•·▪●◦*-][ \t]+/, '')
        .replace(/\s+·\s+/g, ', ')
        .replace(/[•▪●◦]/g, ',')
        .trim(),
    )
    .filter(Boolean);
  if (lines.length <= 1) return lines.join('');
  return lines.map((line, i) => (i < lines.length - 1 ? endWithPause(line) : line)).join(' ');
}

/**
 * Prepara un texto para la voz natural. No cambia el sentido: solo cómo se pronuncia.
 */
export function prepareSpeechText(input: string): string {
  if (!input) return '';
  let text = stripFormatting(input.replace(/\r\n?/g, '\n'));
  // Enlaces y emojis no se leen en voz alta («hache te te pe ese…», «cara sonriente»).
  text = text
    .replace(/\s*\((?:https?:\/\/|www\.)[^\s)]*\)/gi, '')
    .replace(/\b(?:https?:\/\/|www\.)[^\s]*[^\s.,;:!?)]/gi, 'el enlace')
    .replace(/(?:\uD83C[\uDDE6-\uDDFF\uDF00-\uDFFF]|\uD83D[\uDC00-\uDE4F\uDE80-\uDEFF]|\uD83E[\uDD00-\uDEFF])|[\u2600-\u27BF]|\uFE0F|\u200D/g, '')
    .replace(/\s+([,.;:!?])/g, '$1');
  text = text.replace(/[\s\u00A0\u202F]+/g, ' ').trim();
  if (!text) return '';

  // «c/8 h», «c/ 12h» → «cada 8 h» (una dirección «c/ Mayor» no lleva cifra detrás y no se toca)
  text = text.replace(/(^|[^A-Za-z])c\s?\/\s?(?=\d)/gi, '$1cada ');
  // Rangos de cifras pequeñas (no fechas ni códigos): «6-8 horas» → «6 a 8 horas»
  text = text.replace(/(^|[^\d\-–/.,])(\d{1,3})\s?[-–]\s?(\d{1,3})(?!\d|[-–/]\d)/g, '$1$2 a $3');
  text = expandCompositeUnits(text);
  text = expandSimpleUnits(text);
  // «1 gramo/día», «20 miligramos/dosis» → «por día», «por dosis»
  text = text.replace(/\s?\/\s?(día|dia|dosis|semana|mes|toma)(?![A-Za-zÁÉÍÓÚÜÑáéíóúüñ])/gi, ' por $1');
  // Porcentajes: «5 %» → «5 por ciento»
  text = text.replace(/(\d)\s?%/g, '$1 por ciento');
  // Abreviaturas habituales en explicaciones
  // (si la abreviatura cerraba la frase, se conserva el punto: «…, etc. El número…» → «…, etcétera. El número…»)
  text = text
    .replace(/(^|\s)aprox\.(?=\s|$)/gi, '$1aproximadamente')
    .replace(/(^|\s)p\.\s?ej\.(?=\s|$)/gi, '$1por ejemplo')
    .replace(/(^|\s)etc\.(?=\s+[A-ZÁÉÍÓÚÑ¿¡]|\s*$)/g, '$1etcétera.')
    .replace(/(^|\s)etc\.(?=\s|$)/gi, '$1etcétera');
  text = sayEmergencyNumbers(text);
  return text.replace(/\s+/g, ' ').trim();
}

/** Añade un punto final si el apartado no termina en signo de puntuación (la voz hace la pausa correcta). */
export function endWithPause(text: string): string {
  const t = text.trim();
  if (!t) return t;
  return /[.!?…:;]$/.test(t) ? t : `${t}.`;
}

/**
 * Limita una lectura continua a `maxChars` sin partir palabras ni frases:
 * apartados completos en orden y, si el primero ya es demasiado largo, hasta el último final de frase.
 */
export function limitSpeechParts(parts: string[], maxChars: number): { parts: string[]; truncated: boolean } {
  const out: string[] = [];
  let used = 0;
  for (const raw of parts) {
    const part = raw.trim();
    if (!part) continue;
    const extra = out.length ? 1 : 0;
    if (used + extra + part.length <= maxChars) {
      out.push(part);
      used += extra + part.length;
      continue;
    }
    if (!out.length) out.push(cutAtSentence(part, maxChars));
    return { parts: out, truncated: true };
  }
  return { parts: out, truncated: false };
}

function cutAtSentence(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const slice = text.slice(0, maxChars);
  const sentenceEnd = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('? '), slice.lastIndexOf('! '), slice.lastIndexOf('; '));
  if (sentenceEnd > maxChars * 0.4) return slice.slice(0, sentenceEnd + 1).trim();
  const space = slice.lastIndexOf(' ');
  return endWithPause(space > 0 ? slice.slice(0, space) : slice);
}
