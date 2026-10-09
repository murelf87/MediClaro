/** Public, tightly-scoped natural voice previews for Explore MediClaro. */
const KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const MODEL = Deno.env.get('GEMINI_TTS_MODEL') ?? 'gemini-3.8-flash-tts';
const VOICES = new Set(['Sulafat', 'Achird', 'Aoede']);
const ALLOWED = new Set([
  // «Conocer MediClaro» en UNA sola toma (desde el 09/10/2026): la presentación sin la frase final «Ahora te
  // enseñamos, paso a paso…», porque ya no hay partes después. Para regenerar la voz en una sola grabación.
  "Bienvenido a MediClaro. Hemos creado esta aplicación para algo muy sencillo: que entender tus medicamentos no sea complicado. Muchas veces una caja, un prospecto o una indicación médica contienen palabras difíciles, letras pequeñas o información que cuesta recordar. MediClaro te ayuda a tener esa información más clara y accesible, en un solo lugar. Puedes hacer una foto de la caja de un medicamento para intentar identificarlo y consultar información oficial explicada con palabras sencillas. También puedes preguntar al asistente sobre tus medicamentos, escuchar la información en voz alta si leer te resulta incómodo, guardar tus medicamentos para tenerlos siempre a mano y preparar tus datos de emergencia y tu ubicación para cuando realmente hagan falta. Está pensado especialmente para personas mayores, para quienes toman varios medicamentos y también para familiares o cuidadores que quieren ayudar. MediClaro no sustituye a tu médico, a tu farmacéutico ni a los servicios de emergencia. Su objetivo es ayudarte a comprender mejor la información y a sentirte más acompañado en el día a día. Las funciones inteligentes forman parte de MediClaro Premium. Antes de contratarlo puedes conocer tranquilamente cómo funciona la aplicación, y después del pago podrás completar tu acceso con tu número de teléfono.",
  "Bienvenido a MediClaro. Hemos creado esta aplicación para algo muy sencillo: que entender tus medicamentos no sea complicado. Muchas veces una caja, un prospecto o una indicación médica contienen palabras difíciles, letras pequeñas o información que cuesta recordar. MediClaro te ayuda a tener esa información más clara y accesible, en un solo lugar. Puedes hacer una foto de la caja de un medicamento para intentar identificarlo y consultar información oficial explicada con palabras sencillas. También puedes preguntar al asistente sobre tus medicamentos, escuchar la información en voz alta si leer te resulta incómodo, guardar tus medicamentos para tenerlos siempre a mano y preparar tus datos de emergencia y tu ubicación para cuando realmente hagan falta. Está pensado especialmente para personas mayores, para quienes toman varios medicamentos y también para familiares o cuidadores que quieren ayudar. MediClaro no sustituye a tu médico, a tu farmacéutico ni a los servicios de emergencia. Su objetivo es ayudarte a comprender mejor la información y a sentirte más acompañado en el día a día. Las funciones inteligentes forman parte de MediClaro Premium. Antes de contratarlo puedes conocer tranquilamente cómo funciona la aplicación, y después del pago podrás completar tu acceso con tu número de teléfono. Ahora te enseñamos, paso a paso, todo lo que MediClaro puede hacer por ti.",
  'Si MediClaro detecta una situación de malestar, puede avisar a tu cuidador o familiar vinculado, siempre que hayas autorizado esos avisos. Durante el aviso se abre un chat para que pueda hablar contigo y comprobar cómo estás. También puedes compartir tu ubicación actual si das permiso. Si no respondes al mensaje de comprobación, se envía otro aviso. Tu cuidador decide si necesita llamar al uno, uno, dos. Las llamadas autónomas al uno, uno, dos están desactivadas. Las llamadas de voz por Internet requieren que estén disponibles en ambos teléfonos. MediClaro no sustituye a los servicios de emergencia.',
  'Identifica tus medicamentos. Haz una foto de la caja y MediClaro te dice qué medicamento es y para qué sirve, con información oficial explicada con palabras sencillas.',
  'Pregunta al asistente. Escribe tus dudas y te responde con explicaciones claras y sencillas sobre tus medicamentos. No sustituye a tu médico ni a tu farmacéutico.',
  'Escucha el prospecto. Si la letra es pequeña, MediClaro te lo lee en voz alta, despacio y a tu ritmo.',
  'Y si hay una urgencia, tienes el uno, uno, dos siempre a mano, y tu ubicación lista para decírsela a quien te atienda.',
  'Hola. Soy la voz de MediClaro. Te acompañaré con una lectura clara, natural y tranquila.',
  'Hola. Soy el asistente de MediClaro. Estoy aquí para explicarte la información de tus medicamentos de forma sencilla y clara.',
  'El paracetamol sirve para aliviar el dolor leve o moderado y para bajar la fiebre. En adultos se suele tomar 1 comprimido de 1 g cada 6 a 8 horas, sin pasar de 3 al día. Si tienes dudas, consulta a tu farmacéutico.',
  // «¿Quieres ser cuidador/a?» → «Escuchar cómo funciona» (perfil cuidador gratuito: no puede usar la voz Premium).
  'El perfil de cuidador es gratuito. Para vincularte, un paciente con MediClaro Premium te comparte su código de seis números o su QR. Tú envías la solicitud y el paciente debe aceptarla. Solo después recibirás sus avisos y mensajes de emergencia. Puedes dejar de ser cuidador cuando quieras. Si además contratas Premium, conservarás tu perfil de cuidador y tendrás también las funciones Premium para tu propio uso.',
]);
const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
function out(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}
function extractAudio(payload: any): { data: string; mime: string } | null {
  if (typeof payload?.output_audio?.data === 'string' && payload.output_audio.data)
    return { data: payload.output_audio.data, mime: payload.output_audio.mime_type ?? 'audio/wav' };
  const steps = Array.isArray(payload?.steps) ? payload.steps : [];
  for (let i = steps.length - 1; i >= 0; i -= 1) {
    const content = Array.isArray(steps[i]?.content) ? steps[i].content : [];
    for (let j = content.length - 1; j >= 0; j -= 1) {
      if (content[j]?.type === 'audio' && typeof content[j]?.data === 'string')
        return { data: content[j].data, mime: content[j].mime_type ?? 'audio/wav' };
    }
  }
  return null;
}
function pcm24kToWavBase64(pcmBase64: string): string {
  const pcm = Uint8Array.from(atob(pcmBase64), c => c.charCodeAt(0));
  const buffer = new ArrayBuffer(44 + pcm.length);
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  const put = (o: number, s: string) => { for (let i = 0; i < s.length; i += 1) bytes[o + i] = s.charCodeAt(i); };
  put(0, 'RIFF'); view.setUint32(4, 36 + pcm.length, true); put(8, 'WAVE'); put(12, 'fmt ');
  view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
  view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
  put(36, 'data'); view.setUint32(40, pcm.length, true); bytes.set(pcm, 44);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return out({ error: 'Método no permitido' }, 405);
  const body = await req.json().catch(() => ({}));
  const text = typeof body?.text === 'string' ? body.text.replace(/\s+/g, ' ').trim() : '';
  if (!ALLOWED.has(text)) return out({ error: 'Vista previa no permitida' }, 403);
  if (!KEY) return out({ error: 'La voz natural no está configurada.', code: 'TTS_DOWN' }, 503);
  const voice = typeof body?.voice === 'string' && VOICES.has(body.voice) ? body.voice : 'Sulafat';

  const requestModel = (model: string) => {
    const legacy = model.startsWith('gemini-2.5') || model.startsWith('gemini-3.1');
    // Modelos antiguos (respaldo): el estilo va en el propio texto («Say …: texto»; solo se pronuncia lo de detrás de
    // los dos puntos), para que también hablen en español de España.
    const content: any = { type: 'text', text: legacy ? `Say in Spanish from Spain, with a Castilian accent (es-ES), warmly and naturally: ${text}` : text };
    if (!legacy) content.annotations = [{ type: 'speech_metadata', style: 'Warm, natural and friendly Spanish from Spain. Clear diction, relaxed pace, human cadence.' }];
    return fetch('https://generativelanguage.googleapis.com/v1beta/interactions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
      body: JSON.stringify({
        model,
        input: [{ type: 'user_input', content: [content] }],
        response_format: legacy ? { type: 'audio' } : { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
        generation_config: { speech_config: [{ voice }] },
      }),
    });
  };

  const candidates = Array.from(new Set([
    MODEL,
    'gemini-3.8-flash-lite-tts',
    'gemini-2.5-flash-preview-tts',
  ]));
  let lastStatus = 503;
  let lastError = '';
  for (const model of candidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const r = await requestModel(model);
      lastStatus = r.status;
      if (r.ok) {
        const payload = await r.json();
        const audio = extractAudio(payload);
        if (audio) {
          const rawPcm = /l16|pcm/i.test(audio.mime);
          const audioBase64 = rawPcm ? pcm24kToWavBase64(audio.data) : audio.data;
          return out({ audioBase64, mimeType: 'audio/wav', voice, model });
        }
        lastError = 'sin audio';
      } else {
        lastError = await r.text();
      }
      const retryable = r.status === 404 || r.status === 408 || r.status === 429 || r.status >= 500;
      if (!retryable) break;
      if (attempt === 0) await new Promise(resolve => setTimeout(resolve, 350));
    }
  }
  console.error('Gemini TTS preview exhausted fallbacks', lastStatus, lastError.slice(0, 500));
  return out({ error: 'La voz natural no está disponible ahora mismo.', code: `TTS_UPSTREAM_${lastStatus}` }, 503);
});
