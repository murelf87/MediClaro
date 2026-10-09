// Motor de identificación multimodal:
//   código de barras / DataMatrix (móvil) → CN leído en la caja (IA visión) → nombre + principio activo + dosis + forma
// y validación SIEMPRE contra la base oficial, con puntuación de confianza.
import { admin, fail, handler, json } from '../_shared/common.ts';
import { cnFromBarcode } from '../_shared/providers/cima.ts';
import { providerFor } from '../_shared/providers/index.ts';
import { ProviderUnavailableError, type MedicationSummary } from '../_shared/providers/types.ts';
import { gemini } from '../_shared/ai.ts';
import { decide, scoreCandidate, type BoxReading } from '../_shared/confidence.ts';
import { COST, logEvent } from '../_shared/metrics.ts';
import { requirePremium } from '../_shared/entitlements.ts';

const READ_BOX = `Eres un lector de envases de medicamentos (caja, blíster o etiqueta). Devuelve SOLO JSON:
{"nombre": string|null, "principioActivo": string|null, "dosis": string|null, "forma": string|null,
 "laboratorio": string|null, "unidades": string|null, "cn": string|null,
 "legible": boolean, "variosMedicamentos": boolean}
- "cn": el Código Nacional (C.N.) de 6 dígitos si aparece impreso; si no se ve, null.
- "variosMedicamentos": true si en la foto hay envases de medicamentos DISTINTOS.
- Escribe solo lo que se lee literalmente. Si algo no se lee, null. No deduzcas ni completes nada.`;

Deno.serve(handler({ bucket: 'scan', maxPerMinute: 6, maxBodyBytes: 3_000_000 }, async (_req, user, body) => {
  const image = typeof body.image === 'string' ? body.image : null;
  const barcode = typeof body.barcode === 'string' ? body.barcode.slice(0, 120) : null;
  const typedCN = typeof body.cn === 'string' ? body.cn.replace(/\D/g, '').slice(0, 6) : null;
  if (!image && !barcode && !typedCN) return fail('Falta la foto o el código');
  if (image && image.length > 2_800_000) return fail('La foto es demasiado grande');

  const entitlement = await requirePremium(user.id);

  const { data: ok } = await admin.rpc('can_scan', { p_user: user.id });
  if (!ok) return fail('Ha llegado al límite de identificaciones de este mes.', 402, 'LIMIT_REACHED');

  const provider = providerFor(entitlement.country);
  let method = 'barcode';
  let reading: BoxReading = {};
  const byId = new Map<string, MedicationSummary>();
  const scored: { id: string; score: number }[] = [];

  try {
    // 1) Código de barras / DataMatrix / CN tecleado: identificación exacta
    const cn = typedCN?.length === 6 ? typedCN : cnFromBarcode(barcode);
    if (cn) {
      const m = await provider.findByNationalCode(cn);
      if (m) { byId.set(m.id, m); scored.push({ id: m.id, score: scoreCandidate({}, m, true) }); }
    }

    // 2) Sin código válido: lectura visual de la caja
    if (!scored.length && image) {
      method = 'ocr';
      const raw = await gemini({
        system: READ_BOX, json: true, maxTokens: 1200,
        contents: [{ role: 'user', parts: [{ inline_data: { mime_type: 'image/jpeg', data: image } }, { text: 'Lee el envase.' }] }],
      });
      await logEvent(user.id, 'ai_call', 'gemini_vision', COST.gemini_vision);
      try { reading = JSON.parse(raw); } catch { reading = { legible: false }; }

      // 2a) CN impreso en la caja
      const printedCN = String(reading.cn ?? '').replace(/\D/g, '');
      if (!reading.variosMedicamentos && /^\d{6}$/.test(printedCN)) {
        const m = await provider.findByNationalCode(printedCN);
        if (m) { method = 'cn_ocr'; byId.set(m.id, m); scored.push({ id: m.id, score: scoreCandidate(reading, m, true) }); }
      }

      // 2b) Búsqueda por nombre (+dosis) y por principio activo, y puntuación
      if (!scored.length && !reading.variosMedicamentos) {
        method = 'name_ocr';
        const queries = [
          [reading.nombre, reading.dosis].filter(Boolean).join(' '),
          reading.nombre ?? '',
          reading.principioActivo ?? '',
        ].filter(q => q && q.length >= 3);
        for (const q of [...new Set(queries)]) {
          for (const m of await provider.searchMedication(q, 10)) if (!byId.has(m.id)) byId.set(m.id, m);
          if (byId.size >= 15) break;
        }
        for (const m of byId.values()) scored.push({ id: m.id, score: scoreCandidate(reading, m, false) });
      }
    }
  } catch (e) {
    if (e instanceof ProviderUnavailableError) {
      await logEvent(user.id, 'error', 'cima_down');
      return fail('Ahora mismo no hemos podido consultar la información oficial. Inténtelo de nuevo en unos minutos.', 503, 'PROVIDER_DOWN');
    }
    await logEvent(user.id, 'error', 'identify_failed');
    throw e;
  }

  // CIMA puede devolver duplicados regulatorios del mismo medicamento/presentación
  // (por ejemplo, un registro español y otro de otro país con mismo nombre, dosis,
  // principios activos y forma). No deben provocar una ambigüedad falsa.
  const equivalentKey = (m: MedicationSummary) => [
    m.nombre,
    (m.principiosActivos ?? []).map(p => p.nombre).sort().join('|'),
    m.formaFarmaceutica ?? '',
  ].map(v => String(v ?? '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()).join('::');
  const representative = new Map<string, { id: string; score: number }>();
  for (const item of scored) {
    const med = byId.get(item.id);
    if (!med) continue;
    const key = equivalentKey(med);
    const current = representative.get(key);
    if (!current) { representative.set(key, item); continue; }
    const curMed = byId.get(current.id);
    const preferNew = Boolean(med.fotoUrl) && !curMed?.fotoUrl;
    if (preferNew || item.score > current.score) representative.set(key, item);
  }
  const decision = decide([...representative.values()], reading);
  const bestId = decision.status === 'identified' ? decision.best.id : null;
  const bestScore = decision.status === 'identified' ? decision.best.score
    : decision.status === 'ambiguous' ? decision.candidates[0].score : 0;

  // 3) Registrar el intento. Los "no encontrado" no cuentan para el límite.
  const { data: usage, error } = await admin.rpc('consume_scan', {
    p_user: user.id, p_status: decision.status, p_nregistro: bestId,
    p_nombre: bestId ? byId.get(bestId)!.nombre : null, p_score: bestScore, p_method: method,
  });
  if (error) throw error;
  if (!usage?.allowed) return fail('Ha llegado al límite de identificaciones de este mes.', 402, 'LIMIT_REACHED');
  await logEvent(user.id, 'scan', `${decision.status}:${method}`);

  // 4) Pago por uso (solo Premium por encima de lo incluido). Idempotente por scan_id.
  if (usage.overage && usage.stripe_customer_id) {
    try {
      const { stripe, METER_EVENT } = await import('../_shared/stripe.ts');
      await stripe.billing.meterEvents.create({
        event_name: METER_EVENT, identifier: `scan_${usage.scan_id}`,
        payload: { stripe_customer_id: usage.stripe_customer_id, value: '1' },
      });
    } catch (e) {
      // La identificación nunca debe caer porque el medidor de facturación no esté disponible.
      await logEvent(user.id, 'error', 'stripe_meter_failed');
      console.error(e);
    }
  }

  const card = (id: string, score: number) => {
    const m = byId.get(id)!;
    return { id, score: Math.round(score * 100), nombre: m.nombre, laboratorio: m.laboratorio,
      principioActivo: m.principiosActivos.map(p => p.nombre).join(', '), forma: m.formaFarmaceutica, fotoUrl: m.fotoUrl };
  };

  if (decision.status === 'identified') {
    return json({ status: 'identified', scanId: usage.scan_id, best: card(decision.best.id, decision.best.score),
      others: decision.others.map(o => card(o.id, o.score)) });
  }
  if (decision.status === 'ambiguous') {
    return json({ status: 'ambiguous', scanId: usage.scan_id, reason: decision.reason,
      candidates: decision.candidates.map(c => card(c.id, c.score)) });
  }
  const messages: Record<string, string> = {
    blurry: 'La foto está borrosa o con poca luz. Acerque el envase y pruebe otra vez.',
    multiple_items: 'Hemos visto varios medicamentos a la vez. Fotografíe solo uno, por favor.',
    no_match: 'No lo hemos encontrado en la base de datos oficial. Pruebe enfocando el código de barras o el nombre.',
  };
  return json({ status: 'not_found', reason: decision.reason, message: messages[decision.reason] ?? messages.no_match });
}));
