/**
 * Utilidades puras del área "Identificar" (sin UI ni red).
 * - Lectura de parámetros de ruta.
 * - Textos compuestos a partir de datos oficiales (nunca inventados).
 * - Validación del código nacional (C.N.).
 * - Secciones para la lectura en voz alta.
 */
import type {
  IdentifyInput,
  IdentifyResult,
  MedicationCandidate,
  MedicationDetail,
} from '../../types';

// ─── Parámetros de ruta ───────────────────────────────────────────────────────

/** Expo Router puede entregar un parámetro como texto o como lista. */
export function firstParam(value: string | string[] | undefined): string | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return v && v.trim() ? v.trim() : undefined;
}

// ─── Texto en español ─────────────────────────────────────────────────────────

/** "Paracetamol" → "paracetamol" (respeta siglas como "AAS"). */
export function lowerFirst(text: string): string {
  const t = text.trim();
  if (t.length < 2) return t.toLowerCase();
  const second = t.charAt(1);
  if (second !== second.toLowerCase()) return t;
  return t.charAt(0).toLowerCase() + t.slice(1);
}

/** ["a", "b", "c"] → "a, b y c" (usa "e" delante de i-/hi-: "paracetamol e ibuprofeno"). */
export function joinSpanishList(items: string[]): string {
  const list = items.filter((s) => s.trim().length > 0);
  if (list.length <= 1) return list[0] ?? '';
  const last = list[list.length - 1];
  const conjunction = /^h?i(?![aeiouáéíóú])/i.test(last) ? 'e' : 'y';
  return `${list.slice(0, -1).join(', ')} ${conjunction} ${last}`;
}

/** Añade punto final si falta. */
export function endSentence(text: string): string {
  const t = text.trim();
  if (!t) return '';
  return /[.!?…:]$/.test(t) ? t : `${t}.`;
}

function amountText(amount: string | null, unit: string | null): string {
  const a = amount?.trim();
  if (!a) return '';
  const u = unit?.trim();
  return u ? `${a} ${u}` : a;
}

/**
 * "¿Qué es?" compuesto SOLO con datos oficiales de la ficha:
 * "Medicamento con paracetamol 1 g en forma de comprimido. Laboratorio: Kern Pharma, S.L. No necesita receta médica."
 */
export function composeWhatIs(d: MedicationDetail): string {
  const ingredients = d.activeIngredients
    .map((p) => [lowerFirst(p.name), amountText(p.amount, p.unit)].filter(Boolean).join(' '))
    .filter((s) => s.length > 0);
  const form = d.pharmaceuticalForm?.trim() ? lowerFirst(d.pharmaceuticalForm) : '';

  let first = 'Medicamento';
  if (ingredients.length) first += ` con ${joinSpanishList(ingredients)}`;
  if (form) first += ` en forma de ${form}`;
  const parts = [ingredients.length || form ? `${first}.` : 'Medicamento registrado en la Agencia Española de Medicamentos (AEMPS).'];

  if (d.laboratory?.trim()) parts.push(endSentence(`Laboratorio: ${d.laboratory.trim()}`));
  parts.push(d.requiresPrescription ? 'Necesita receta médica.' : 'No necesita receta médica.');
  return parts.join(' ');
}

/** "Comprimido · Sin receta" */
export function detailSubtitle(d: MedicationDetail): string {
  return [d.pharmaceuticalForm, d.requiresPrescription ? 'Con receta' : 'Sin receta'].filter(Boolean).join(' · ');
}

// ─── Código nacional (C.N.) ───────────────────────────────────────────────────

export type NationalCodeCheck = { ok: true; input: IdentifyInput } | { ok: false; error: string };

/**
 * Acepta "712729", "7127294" o "712729.4" (se queda con las 6 primeras cifras: la 7.ª es de control).
 * Si se escriben las 13 cifras del código de barras, se envían como código de barras.
 */
export function parseNationalCode(raw: string): NationalCodeCheck {
  const digits = raw.replace(/\D+/g, '');
  if (!digits) return { ok: false, error: 'Escribe el código nacional que aparece en la caja.' };
  if (digits.length === 6) return { ok: true, input: { nationalCode: digits } };
  if (digits.length === 7) return { ok: true, input: { nationalCode: digits.slice(0, 6) } };
  if (digits.length === 13) return { ok: true, input: { barcode: digits } };
  if (digits.length < 6) {
    return { ok: false, error: `Faltan cifras: has escrito ${digits.length} y el código nacional tiene 6.` };
  }
  return { ok: false, error: 'Sobran cifras: el código nacional tiene 6 (a veces con una más después del punto).' };
}

/** ¿La identificación se hizo con un código (barras o C.N.) en lugar de una foto? */
export function isCodeInput(input: IdentifyInput | null): boolean {
  return Boolean(input && !input.imageBase64 && (input.barcode || input.nationalCode));
}

// ─── Resultado de la identificación ───────────────────────────────────────────

export interface ResolvedResult {
  med: MedicationCandidate;
  /** true si la persona lo eligió de la lista de parecidos. */
  picked: boolean;
  /** Hay otros parecidos para elegir. */
  hasAlternatives: boolean;
}

/** Busca el medicamento a mostrar en el último resultado (mejor coincidencia o el elegido por id). */
export function resolveFromLastResult(last: IdentifyResult | null, id: string | undefined): ResolvedResult | null {
  if (!last) return null;
  if (last.status === 'identified') {
    const hasAlternatives = last.others.length > 0;
    if (!id || id === last.best.id) return { med: last.best, picked: false, hasAlternatives };
    const other = last.others.find((c) => c.id === id);
    return other ? { med: other, picked: true, hasAlternatives } : null;
  }
  if (last.status === 'ambiguous') {
    if (!id) return null;
    const candidate = last.candidates.find((c) => c.id === id);
    return candidate ? { med: candidate, picked: true, hasAlternatives: last.candidates.length > 1 } : null;
  }
  return null;
}

/** Lista para "Elige tu medicamento": parecidos (ambiguo) o [mejor, ...otros] (identificado). */
export function candidatesFromLastResult(last: IdentifyResult | null): MedicationCandidate[] | null {
  if (!last) return null;
  const list = last.status === 'ambiguous' ? last.candidates : last.status === 'identified' ? [last.best, ...last.others] : [];
  return list.length ? list : null;
}

export function matchLabel(score: number): { label: string; tone: 'success' | 'warning' } {
  return score >= 85 ? { label: 'Coincidencia alta', tone: 'success' } : { label: 'Coincidencia media', tone: 'warning' };
}

// ─── Lectura en voz alta ──────────────────────────────────────────────────────

export type ReadingTone = 'success' | 'primary' | 'warning' | 'danger';

export interface ReadingSection {
  id: string;
  title: string;
  text: string;
  tone: ReadingTone;
}

const LEAFLET_TONES: Record<MedicationDetail['leaflet'][number]['key'], ReadingTone> = {
  indicaciones: 'success',
  antes: 'danger',
  posologia: 'warning',
  efectos: 'danger',
  conservacion: 'primary',
};

/** "3. Cómo tomar X" → "Cómo tomar X" (la lista ya va numerada). */
export function cleanLeafletTitle(title: string): string {
  return title.replace(/^\s*\d+\s*[.)-]\s*/, '').trim() || title;
}

/**
 * Secciones que se leen, con los MISMOS textos que la ficha:
 * Qué es · Para qué se utiliza · Cómo tomarlo · Advertencias importantes.
 * Si no hay resumen sencillo, se lee el prospecto oficial por apartados.
 */
export function buildReadingSections(d: MedicationDetail): ReadingSection[] {
  const sections: ReadingSection[] = [{ id: 'que-es', title: 'Qué es', text: composeWhatIs(d), tone: 'success' }];
  if (d.simple) {
    if (d.simple.whatFor.trim()) {
      sections.push({ id: 'para-que', title: 'Para qué se utiliza', text: d.simple.whatFor.trim(), tone: 'success' });
    }
    if (d.simple.howToTake.trim()) {
      sections.push({ id: 'como', title: 'Cómo tomarlo', text: d.simple.howToTake.trim(), tone: 'warning' });
    }
    if (d.simple.warnings.length) {
      sections.push({
        id: 'advertencias',
        title: 'Advertencias importantes',
        text: d.simple.warnings.map(endSentence).join(' '),
        tone: 'danger',
      });
    }
    return sections;
  }
  d.leaflet.forEach((s, i) => {
    sections.push({ id: `prospecto-${s.key}-${i}`, title: cleanLeafletTitle(s.title), text: s.text.trim(), tone: LEAFLET_TONES[s.key] ?? 'primary' });
  });
  return sections;
}

/** Android limita cada lectura (~4000 caracteres): los apartados largos se leen en trozos. */
const MAX_SPEECH_CHARS = 3000;

export function splitForSpeech(text: string, max: number = MAX_SPEECH_CHARS): string[] {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean ? [clean] : [];
  const chunks: string[] = [];
  let rest = clean;
  while (rest.length > max) {
    const slice = rest.slice(0, max);
    const sentenceCut = Math.max(slice.lastIndexOf('. '), slice.lastIndexOf('; '), slice.lastIndexOf(': '));
    const spaceCut = slice.lastIndexOf(' ');
    const end = sentenceCut > max * 0.5 ? sentenceCut + 1 : spaceCut > 0 ? spaceCut : max;
    chunks.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export interface SpeechPlan {
  /** Trozos que se leen (formato de useSectionSpeech). */
  sections: { id: string; title: string; text: string }[];
  /** Primer trozo de cada apartado. */
  startOf: number[];
  /** Apartado al que pertenece cada trozo. */
  ownerOf: number[];
}

export function buildSpeechPlan(sections: ReadingSection[]): SpeechPlan {
  const plan: SpeechPlan = { sections: [], startOf: [], ownerOf: [] };
  sections.forEach((s, i) => {
    const chunks = splitForSpeech(s.text);
    plan.startOf.push(plan.sections.length);
    if (!chunks.length) {
      plan.sections.push({ id: s.id, title: s.title, text: '' });
      plan.ownerOf.push(i);
      return;
    }
    chunks.forEach((chunk, k) => {
      // Solo el primer trozo anuncia el título del apartado.
      plan.sections.push({ id: `${s.id}-${k}`, title: k === 0 ? s.title : '', text: chunk });
      plan.ownerOf.push(i);
    });
  });
  return plan;
}

// ─── Velocidad de lectura ─────────────────────────────────────────────────────

export type SpeedOption = 'slow' | 'normal' | 'fast';

export const SPEED_RATES: Record<SpeedOption, number> = { slow: 0.7, normal: 0.85, fast: 1.0 };

export function speedFromRate(rate: number): SpeedOption {
  if (rate <= 0.77) return 'slow';
  if (rate >= 0.93) return 'fast';
  return 'normal';
}
