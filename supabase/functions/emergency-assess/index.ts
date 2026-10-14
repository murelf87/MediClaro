/**
 * emergency-assess — MediClaro
 *
 * Recibe el perfil de emergencia del paciente + últimos mensajes del chat.
 * Gemini evalúa la severidad y genera:
 *   - severity: 'alta' | 'media' | 'baja'
 *   - summary: resumen breve para la tarjeta de la app
 *   - voiceMessage: texto optimizado para leer por altavoz al operador del 112
 */
import { handler, json, fail, admin } from '../_shared/common.ts';
import { gemini } from '../_shared/ai.ts';

const SYSTEM = `
Eres un asistente médico de emergencias entrenado para evaluar situaciones críticas.
Tu respuesta SIEMPRE en JSON con este esquema exacto:
{
  "severity": "alta" | "media" | "baja",
  "summary": "<2 frases máximo del estado del paciente>",
  "voiceMessage": "<mensaje completo para leer al operador del 112 en voz alta, máx 120 palabras, en 1.ª persona del paciente o 3.ª si no puede hablar>"
}

Criterios de severidad:
- alta: riesgo vital inmediato, reacción alérgica grave, pérdida de conciencia, sobredosis confirmada
- media: malestar importante, posible intoxicación, requiere atención pronta pero estable
- baja: duda sobre medicación, malestar leve, precaución

Si no hay contexto de chat, usa solo el perfil médico del paciente para redactar el mensaje.
Siempre incluye nombre, dirección y datos médicos relevantes en el voiceMessage.
Habla con claridad y calma, pensando que hay un operador que lo leerá/escuchará.
Responde SIEMPRE en español.
`.trim();

export default handler(
  { bucket: 'emergency_assess', maxPerMinute: 5, maxBodyBytes: 8_000 },
  async (_req, user, body) => {
    const profile: Record<string, string> = body.profile ?? {};
    const recentMessages: string[] = body.recentMessages ?? [];

    // Construir contexto médico
    const medContext = [
      profile.full_name      ? `Paciente: ${profile.full_name}` : '',
      profile.address        ? `Dirección: ${profile.address}` : '',
      profile.postal_code && profile.city ? `Código postal: ${profile.postal_code}, ${profile.city}` : '',
      profile.blood_type     ? `Grupo sanguíneo: ${profile.blood_type}` : '',
      profile.allergies      ? `Alergias conocidas: ${profile.allergies}` : '',
      profile.medical_conditions ? `Enfermedades crónicas: ${profile.medical_conditions}` : '',
      profile.current_medications ? `Medicación habitual: ${profile.current_medications}` : '',
      profile.emergency_contact_name && profile.emergency_contact_phone
        ? `Contacto de emergencia: ${profile.emergency_contact_name} — ${profile.emergency_contact_phone}` : '',
    ].filter(Boolean).join('\n');

    // Últimos mensajes del chat (contexto de lo que el paciente comunicó)
    const chatContext = recentMessages.length > 0
      ? `\n\nÚltimos mensajes del paciente antes de pulsar emergencia:\n${recentMessages.slice(-6).join('\n')}`
      : '';

    const userMessage = `
PERFIL MÉDICO DEL PACIENTE:
${medContext || 'Sin datos de perfil proporcionados.'}
${chatContext}

Por favor evalúa la situación y genera la respuesta JSON.
`.trim();

    let raw = '';
    try {
      raw = await gemini({
        system: SYSTEM,
        contents: [{ role: 'user', parts: [{ text: userMessage }] }],
        json: true,
        maxTokens: 512,
      });

      const result = JSON.parse(raw);
      if (!result.severity || !result.summary || !result.voiceMessage) {
        throw new Error('Respuesta incompleta de Gemini');
      }

      // Registrar uso (sin datos personales)
      await admin.from('usage_events').insert({
        user_id: user.id,
        kind: 'emergency_assess',
        detail: result.severity,
        cost_micros: 0,
      }).catch(() => {});

      return json({
        severity: result.severity,
        summary: result.summary,
        voiceMessage: result.voiceMessage,
      });
    } catch (e) {
      console.error('emergency-assess error', e, 'raw:', raw);

      // Fallback con datos del perfil (no falla la emergencia)
      const fallback = buildFallback(profile);
      return json({
        severity: 'desconocida',
        summary: 'No se pudo evaluar automáticamente. Use los datos del paciente.',
        voiceMessage: fallback,
      });
    }
  },
);

function buildFallback(p: Record<string, string>): string {
  const parts = [
    p.full_name     ? `Me llamo ${p.full_name}.` : 'Un paciente ha pulsado el botón de emergencia.',
    p.address       ? `Estoy en ${p.address},` : '',
    p.postal_code && p.city ? `código postal ${p.postal_code}, ${p.city}.` : '',
    p.blood_type    ? `Grupo sanguíneo ${p.blood_type}.` : '',
    p.allergies     ? `Tengo alergia a: ${p.allergies}.` : '',
    p.medical_conditions ? `Padezco: ${p.medical_conditions}.` : '',
    p.current_medications ? `Tomo habitualmente: ${p.current_medications}.` : '',
    p.emergency_contact_name && p.emergency_contact_phone
      ? `Mi contacto de emergencia es ${p.emergency_contact_name}, teléfono ${p.emergency_contact_phone}.` : '',
    'Por favor, envíen asistencia médica urgente.',
  ].filter(Boolean);
  return parts.join(' ');
}
