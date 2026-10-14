import { admin } from './common.ts';

// Coste estimado por llamada (millonésimas de €). Ajústelo con su factura real.
export const COST = { gemini_vision: 400, gemini_text: 150 };

/** Registra uso y coste SIN información médica (ni fotos ni textos de chat). */
export async function logEvent(userId: string | null, kind: 'scan' | 'chat' | 'ai_call' | 'error', detail: string, costMicros = 0) {
  try {
    await admin.from('usage_events').insert({ user_id: userId, kind, detail: detail.slice(0, 80), cost_micros: costMicros });
  } catch { /* nunca romper el flujo por métricas */ }
  console.log(JSON.stringify({ level: kind === 'error' ? 'error' : 'info', kind, detail, ts: new Date().toISOString() }));
}
