// IA con Google Gemini. Fallback automático entre modelos disponibles para evitar
// que una retirada/renombrado de modelo deje MediClaro sin asistente.
const KEY = Deno.env.get('GEMINI_API_KEY') ?? '';
const PRIMARY_MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-3.8-flash';
const FALLBACK_MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
const RETRYABLE = new Set([404, 408, 429, 500, 502, 503, 504]);

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function gemini(opts: {
  system: string;
  contents: { role: 'user' | 'model'; parts: Part[] }[];
  json?: boolean;
  maxTokens?: number;
  preferredModel?: string;
}): Promise<string> {
  if (!KEY) throw new Error('Gemini API key no configurada');
  const primaryModel = opts.preferredModel ?? PRIMARY_MODEL;
  const models = [primaryModel, ...FALLBACK_MODELS.filter(m => m !== primaryModel)];
  let lastError = 'Gemini no disponible';

  const textOnly = opts.contents.every((c) => c.parts.every((p) => 'text' in p));

  for (const model of models) {
    const isGemma = model.startsWith('gemma-');
    if (isGemma && !textOnly) continue;
    const controller = new AbortController();
    const timeoutMs = model === 'gemini-3.8-flash' ? 30_000 : model === 'gemini-3.6-flash' ? 15_000 : 12_000;
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const conversation = opts.contents
        .map((c) => `${c.role === 'model' ? 'ASISTENTE' : 'USUARIO'}: ${c.parts.map((p) => 'text' in p ? p.text : '').join(' ')}`)
        .join('\n');
      const body = isGemma
        ? {
            contents: [{ role: 'user', parts: [{ text: `${opts.system}\n\n${opts.json ? 'Responde SOLO con JSON válido, sin texto adicional.\n\n' : ''}CONVERSACIÓN:\n${conversation}\n\nASISTENTE:` }] }],
            generationConfig: { temperature: 0.2, maxOutputTokens: opts.maxTokens ?? 800 },
          }
        : {
            system_instruction: { parts: [{ text: opts.system }] },
            contents: opts.contents,
            generationConfig: {
              temperature: 0.2,
              maxOutputTokens: opts.maxTokens ?? 800,
              ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: ['gemini-3.8-flash', 'gemini-3.7-flash'].includes(model) ? 'low' : 'minimal' } } : {}),
              ...(opts.json ? { responseMimeType: 'application/json' } : {}),
            },
            safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }],
          };
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        signal: controller.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
        body: JSON.stringify(body),
      });
      if (!r.ok) {
        lastError = `Gemini ${model} ${r.status}: ${await r.text()}`;
        if (RETRYABLE.has(r.status)) continue;
        throw new Error(lastError);
      }
      const d = await r.json();
      const text = d?.candidates?.[0]?.content?.parts?.filter((p: any) => p?.thought !== true).map((p: any) => p.text ?? '').join('') ?? '';
      if (text) {
        if (opts.json) {
          try { JSON.parse(text); } catch {
            lastError = `Gemini ${model} devolvió JSON incompleto o inválido`;
            continue;
          }
        }
        return text;
      }
      lastError = `Gemini ${model} devolvió respuesta vacía`;
    } catch (e) {
      lastError = e instanceof Error ? e.message : String(e);
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(lastError);
}
