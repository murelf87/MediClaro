/**
 * Tope mensual de gasto de la voz natural. Antes de pedir voz a Google se reservan los caracteres en el servidor
 * (public.voice_budget_take, atómica): si el mes ya llegó al tope que fijó el propietario en el panel, no se llama a
 * Google y la app lee con la voz del teléfono. Si la función aún no existe en la base de datos (migración sin aplicar)
 * o falla la consulta, no se bloquea la voz: es lo mismo que había antes.
 */
import { admin } from './common.ts';

export const TTS_BUDGET_CODE = 'TTS_BUDGET';
export const TTS_BUDGET_MESSAGE = 'La voz natural ha llegado al tope de este mes.';

export async function reserveVoiceBudget(chars: number): Promise<boolean> {
  try {
    const { data, error } = await admin.rpc('voice_budget_take', { p_chars: Math.max(0, Math.round(chars)) });
    if (error) {
      console.error('voice_budget_take', error.code, error.message);
      return true;
    }
    return data !== false;
  } catch (e) {
    console.error('voice_budget_take', e instanceof Error ? e.message : String(e));
    return true;
  }
}
