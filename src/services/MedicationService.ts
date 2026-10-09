/**
 * MedicationService — identificación, fichas oficiales, "Mis medicamentos" e historial.
 *
 * Backend usado (sin modificarlo):
 *  - Edge Function `identify-medicine` { image? | barcode? | cn? }
 *  - Edge Function `medicine-detail`  { id }  (datos oficiales CIMA · AEMPS)
 *  - tabla `saved_medications`  (CRUD propio con RLS; incluye `favorito`)
 *  - tabla `scans`              (historial de identificaciones, lectura propia)
 *
 * La imagen de la caja se envía para identificarla y el backend NO la guarda.
 */
import { supabase, invokeFunction, requireUserId, dbError, AppError } from '../api';
import { localStore } from '../api/storage';
import { MedicationReadCache } from './MedicationReadCache';
let lastReadUser = '';

import { AiConsentService } from './AiConsentService';
import { prettifyMedicineName, prettifySentence, shortMedicineName } from '../utils/medicineText';
import type {
  HistoryMethod,
  HistoryStatus,
  IdentifyInput,
  IdentifyResult,
  Medication,
  MedicationCandidate,
  MedicationDetail,
  MedicationHistoryEntry,
  SavedMedication,
} from '../types';

// ─── Formas crudas del backend ────────────────────────────────────────────────

interface RawCard {
  id: string;
  score: number;
  nombre: string;
  laboratorio: string | null;
  principioActivo: string;
  forma: string | null;
  fotoUrl: string | null;
}

type RawIdentify =
  | { status: 'identified'; scanId: number; best: RawCard; others: RawCard[] }
  | { status: 'ambiguous'; scanId: number; reason: 'low_confidence' | 'close_matches'; candidates: RawCard[] }
  | { status: 'not_found'; reason: 'blurry' | 'multiple_items' | 'no_match'; message: string };

interface RawSource {
  label?: string;
  url?: string | null;
  fetchedAt?: string;
}

interface RawDetail {
  medicine: {
    id: string;
    nombre: string;
    laboratorio: string | null;
    principiosActivos: { nombre: string; cantidad: string | null; unidad: string | null }[];
    formaFarmaceutica: string | null;
    presentaciones: { cn: string; nombre: string }[];
    receta: boolean;
    comercializado: boolean;
    fotoUrl: string | null;
    source: RawSource;
  };
  simple: {
    paraQue: string;
    comoSeToma: string;
    avisos: string[];
    conservacion: string;
    generatedFrom: string;
    aiAssisted: boolean;
  } | null;
  leaflet: { key: MedicationDetail['leaflet'][number]['key']; title: string; text: string }[];
  leafletUrl: string | null;
  sheetUrl: string | null;
}

interface RawSavedRow {
  id: string | number;
  nregistro: string;
  nombre: string;
  principio_activo: string | null;
  presentacion: string | null;
  favorito: boolean | null;
  created_at: string;
}

interface RawScanRow {
  id: number;
  nregistro: string | null;
  nombre: string | null;
  confidence: string | null;
  created_at: string;
  status: string | null;
  method: string | null;
}

// ─── Caché local de imágenes (id → url) ───────────────────────────────────────

const IMAGE_CACHE_KEY = 'mediclaro.medimg.v1';
const MAX_IMAGE_CACHE = 300;
let imageCache: Record<string, string | null> | null = null;
const inflight = new Map<string, Promise<string | null>>();
let activeFetches = 0;
const fetchQueue: (() => void)[] = [];
const imageFetchTimes: number[] = [];

async function loadImageCache(): Promise<Record<string, string | null>> {
  if (!imageCache) imageCache = await localStore.getJSON<Record<string, string | null>>(IMAGE_CACHE_KEY, {});
  return imageCache;
}

async function rememberImage(id: string, url: string | null): Promise<void> {
  const cache = await loadImageCache();
  cache[id] = url;
  const keys = Object.keys(cache);
  if (keys.length > MAX_IMAGE_CACHE) {
    keys.slice(0, keys.length - MAX_IMAGE_CACHE).forEach((k) => delete cache[k]);
  }
  void localStore.setJSON(IMAGE_CACHE_KEY, cache);
}

function withConcurrency<T>(task: () => Promise<T>, limit = 2): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const run = () => {
      activeFetches += 1;
      task()
        .then(resolve, reject)
        .finally(() => {
          activeFetches -= 1;
          const next = fetchQueue.shift();
          if (next) next();
        });
    };
    if (activeFetches < limit) run();
    else fetchQueue.push(run);
  });
}

// ─── Mapeos ───────────────────────────────────────────────────────────────────

export function mapCard(card: RawCard): MedicationCandidate {
  const officialName = prettifyMedicineName(card.nombre);
  const ingredient = card.principioActivo ? prettifySentence(card.principioActivo) : null;
  return {
    id: String(card.id),
    name: shortMedicineName(officialName, ingredient),
    officialName,
    laboratory: card.laboratorio ? prettifyMedicineName(card.laboratorio) : null,
    activeIngredient: card.principioActivo ? prettifySentence(card.principioActivo) : null,
    pharmaceuticalForm: card.forma ? prettifySentence(card.forma) : null,
    imageUrl: card.fotoUrl ?? null,
    score: Math.max(0, Math.min(100, Math.round(card.score))),
  };
}

/** Mensajes propios (tuteo) según el motivo que devuelve el backend. */
const NOT_FOUND_MESSAGES: Record<'blurry' | 'multiple_items' | 'no_match', string> = {
  blurry: 'La foto ha salido borrosa. Acerca la caja, busca buena luz y vuelve a intentarlo.',
  multiple_items: 'Aparece más de un medicamento. Haz la foto a una sola caja.',
  no_match: 'No lo hemos encontrado en la base oficial. Prueba con el código nacional (C.N.) de la caja.',
};

export function mapIdentify(raw: RawIdentify): IdentifyResult {
  switch (raw.status) {
    case 'identified':
      return { status: 'identified', scanId: raw.scanId, best: mapCard(raw.best), others: (raw.others ?? []).map(mapCard) };
    case 'ambiguous':
      return { status: 'ambiguous', scanId: raw.scanId, reason: raw.reason, candidates: (raw.candidates ?? []).map(mapCard) };
    case 'not_found':
    default: {
      const reason = (raw as { reason?: 'blurry' | 'multiple_items' | 'no_match' }).reason ?? 'no_match';
      return { status: 'not_found', reason, message: NOT_FOUND_MESSAGES[reason] ?? NOT_FOUND_MESSAGES.no_match };
    }
  }
}

export function mapDetail(raw: RawDetail): MedicationDetail {
  const m = raw.medicine;
  const officialName = prettifyMedicineName(m.nombre);
  const firstIngredient = m.principiosActivos?.[0]?.nombre ? prettifySentence(m.principiosActivos[0].nombre) : null;
  return {
    id: String(m.id),
    name: shortMedicineName(officialName, firstIngredient),
    officialName,
    laboratory: m.laboratorio ? prettifyMedicineName(m.laboratorio) : null,
    activeIngredient: m.principiosActivos?.length
      ? m.principiosActivos.map((p) => prettifySentence(p.nombre)).join(', ')
      : null,
    pharmaceuticalForm: m.formaFarmaceutica ? prettifySentence(m.formaFarmaceutica) : null,
    imageUrl: m.fotoUrl ?? null,
    activeIngredients: (m.principiosActivos ?? []).map((p) => ({
      name: prettifySentence(p.nombre),
      amount: p.cantidad ?? null,
      unit: p.unidad ?? null,
    })),
    presentations: (m.presentaciones ?? []).map((p) => ({ nationalCode: p.cn, name: prettifyMedicineName(p.nombre) })),
    requiresPrescription: Boolean(m.receta),
    isMarketed: Boolean(m.comercializado),
    simple: raw.simple
      ? {
          whatFor: raw.simple.paraQue ?? '',
          howToTake: raw.simple.comoSeToma ?? '',
          warnings: Array.isArray(raw.simple.avisos) ? raw.simple.avisos.filter((a) => typeof a === 'string' && a.trim()) : [],
          storage: raw.simple.conservacion ?? '',
          generatedFrom: raw.simple.generatedFrom ?? 'Prospecto oficial (CIMA · AEMPS)',
          aiAssisted: raw.simple.aiAssisted !== false,
        }
      : null,
    leaflet: (raw.leaflet ?? []).filter((s) => s.text?.trim()).map((s) => ({ key: s.key, title: s.title, text: s.text })),
    leafletUrl: raw.leafletUrl ?? null,
    technicalSheetUrl: raw.sheetUrl ?? null,
    source: {
      label: m.source?.label ?? 'CIMA · Agencia Española de Medicamentos (AEMPS)',
      url: m.source?.url ?? null,
      fetchedAt: m.source?.fetchedAt ?? null,
    },
  };
}

function mapSavedRow(row: RawSavedRow, imageUrl: string | null): SavedMedication {
  const officialName = prettifyMedicineName(row.nombre);
  const ingredient = row.principio_activo ? prettifySentence(row.principio_activo) : null;
  return {
    savedId: String(row.id),
    id: row.nregistro,
    name: shortMedicineName(officialName, ingredient),
    officialName,
    laboratory: null,
    activeIngredient: row.principio_activo ? prettifySentence(row.principio_activo) : null,
    pharmaceuticalForm: row.presentacion ? prettifySentence(row.presentacion) : null,
    imageUrl,
    isFavorite: Boolean(row.favorito),
    savedAt: row.created_at,
  };
}

function mapMethod(method: string | null): HistoryMethod {
  if (method === 'barcode') return 'barcode';
  if (method === 'ocr' || method === 'name_ocr' || method === 'cn_ocr') return 'photo';
  if (method === 'cn') return 'national_code';
  return 'unknown';
}

function mapStatus(status: string | null): HistoryStatus {
  if (status === 'identified' || status === 'ambiguous') return status;
  return 'not_found';
}

// ─── Estado de la última identificación (entre pantallas) ─────────────────────

let pendingInput: IdentifyInput | null = null;
let lastResult: IdentifyResult | null = null;
/** La última foto de caja enviada a identificar (para guardarla como foto propia: MedicinePhotoService). */
let lastScanImage: string | null = null;

// ─── Servicio ─────────────────────────────────────────────────────────────────

export const MedicationService = {
  /** Guarda la foto/código a identificar para la pantalla "Procesando". */
  setPendingIdentification(input: IdentifyInput): void {
    pendingInput = input;
    lastScanImage = input.imageBase64 ?? null;
  },
  /** Foto de la caja de la última identificación (solo en memoria, hasta que se guarda o se identifica otra). */
  getLastScanImage(): string | null {
    return lastScanImage;
  },
  clearLastScanImage(): void {
    lastScanImage = null;
  },
  getPendingIdentification(): IdentifyInput | null {
    return pendingInput;
  },
  clearPendingIdentification(): void {
    pendingInput = null;
  },
  getLastResult(): IdentifyResult | null {
    return lastResult;
  },

  async identifyMedication(input: IdentifyInput): Promise<IdentifyResult> {
    await requireUserId();
    const body: Record<string, string> = {};
    if (input.nationalCode) body.cn = input.nationalCode.replace(/\D+/g, '').slice(0, 6);
    if (input.barcode) body.barcode = input.barcode.slice(0, 120);
    if (input.imageBase64) {
      // La foto la lee una IA de terceros (Gemini): solo con permiso explícito.
      await AiConsentService.assertGranted();
      body.image = input.imageBase64.replace(/^data:[^,]+,/, '');
    }
    if (!body.cn && !body.barcode && !body.image) {
      throw new AppError('invalid_input', 'Falta la foto o el código del medicamento.');
    }
    const raw = await invokeFunction<RawIdentify>('identify-medicine', body, { timeoutMs: 60_000 });
    const result = mapIdentify(raw);
    lastResult = result;
    if (result.status === 'identified') {
      void rememberImage(result.best.id, result.best.imageUrl);
      result.others.forEach((c) => void rememberImage(c.id, c.imageUrl));
    } else if (result.status === 'ambiguous') {
      result.candidates.forEach((c) => void rememberImage(c.id, c.imageUrl));
    }
    return result;
  },

  /**
   * Búsqueda por nombre.
   * PENDIENTE DE BACKEND: no existe endpoint de búsqueda (BACKEND_REQUIREMENTS.md §4).
   * La UI no la utiliza; se mantiene para completar el contrato.
   */
  async searchMedication(_query: string): Promise<Medication[]> {
    throw new AppError('not_configured', 'La búsqueda por nombre todavía no está disponible.');
  },

  async getMedication(id: string): Promise<MedicationDetail> {
    await requireUserId();
    if (!/^[\w-]{1,20}$/.test(id)) throw new AppError('invalid_input', 'Medicamento no válido.');
    const raw = await invokeFunction<RawDetail>('medicine-detail', { id }, { timeoutMs: 45_000 });
    const detail = mapDetail(raw);
    void rememberImage(detail.id, detail.imageUrl);
    return detail;
  },

  /** Imagen del envase (caché local → ficha oficial). Nunca lanza. */
  async getMedicationImage(id: string): Promise<string | null> {
    const cache = await loadImageCache();
    if (id in cache) return cache[id];
    const existing = inflight.get(id);
    if (existing) return existing;
    // Respeta el límite del backend (medicine-detail: 20 peticiones/min):
    // como mucho 8 búsquedas de imagen por minuto; el resto se completa en otra visita.
    const now = Date.now();
    while (imageFetchTimes.length && now - imageFetchTimes[0] > 60_000) imageFetchTimes.shift();
    if (imageFetchTimes.length >= 8) return null;
    imageFetchTimes.push(now);
    const promise = withConcurrency(async () => {
      try {
        const detail = await MedicationService.getMedication(id);
        return detail.imageUrl;
      } catch {
        return null;
      }
    }).finally(() => inflight.delete(id));
    inflight.set(id, promise);
    return promise;
  },

  isUsingCachedData(kind: 'saved' | 'history'): boolean { return MedicationReadCache.isOffline(lastReadUser, kind); },
  async getSavedMedications(): Promise<SavedMedication[]> {
    const user = await requireUserId(); lastReadUser = user;
    const rows = await MedicationReadCache.read<RawSavedRow>(user, 'saved', supabase.from('saved_medications')
      .select('id, nregistro, nombre, principio_activo, presentacion, favorito, created_at').eq('user_id', user)
      .order('favorito', { ascending: false }).order('created_at', { ascending: false }));
    const cache = await loadImageCache();
    return rows.map(row => mapSavedRow(row, cache[row.nregistro] ?? null));
  },
  async getSavedMedication(id: string): Promise<SavedMedication | null> {
    return (await MedicationService.getSavedMedications()).find(m => m.id === id) ?? null;
  },

  async isSaved(id: string): Promise<{ saved: boolean; favorite: boolean }> {
    const saved = await MedicationService.getSavedMedication(id);
    return { saved: Boolean(saved), favorite: Boolean(saved?.isFavorite) };
  },

  async saveMedication(med: Medication, opts?: { favorite?: boolean }): Promise<void> {
    const userId = await requireUserId();
    const row: Record<string, unknown> = {
      user_id: userId,
      nregistro: med.id,
      // Se guarda el nombre OFICIAL completo (el corto se calcula al mostrar)
      nombre: med.officialName || med.name,
      principio_activo: med.activeIngredient,
      presentacion: med.pharmaceuticalForm,
    };
    if (opts?.favorite !== undefined) row.favorito = opts.favorite;
    const { error } = await supabase.from('saved_medications').upsert(row, { onConflict: 'user_id,nregistro' });
    if (error) throw dbError(error);
    if (med.imageUrl !== undefined) void rememberImage(med.id, med.imageUrl);
    await MedicationService.getSavedMedications().catch(() => undefined);
  },

  async setFavorite(id: string, favorite: boolean): Promise<void> {
    await requireUserId();
    const { error } = await supabase.from('saved_medications').update({ favorito: favorite }).eq('nregistro', id);
    if (error) throw dbError(error);
    await MedicationService.getSavedMedications().catch(() => undefined);
  },

  async removeMedication(id: string): Promise<void> {
    await requireUserId();
    const { error } = await supabase.from('saved_medications').delete().eq('nregistro', id);
    if (error) throw dbError(error);
    await MedicationService.getSavedMedications().catch(() => undefined);
  },

  async getHistory(limit = 100): Promise<MedicationHistoryEntry[]> {
    const user = await requireUserId(); lastReadUser = user;
    const data = await MedicationReadCache.read<RawScanRow>(user, 'history', supabase.from('scans')
      .select('id, nregistro, nombre, confidence, created_at, status, method').eq('user_id', user)
      .order('created_at', { ascending: false }).limit(Math.max(1, Math.min(100, limit))));
    return ((data ?? []) as RawScanRow[]).map((r) => ({
      id: r.id,
      medicationId: r.nregistro,
      medicationName: r.nombre ? shortMedicineName(prettifyMedicineName(r.nombre)) : null,
      status: mapStatus(r.status),
      method: mapMethod(r.method),
      confidence: r.confidence === 'alta' || r.confidence === 'media' || r.confidence === 'baja' ? r.confidence : null,
      createdAt: r.created_at,
    }));
  },
};
