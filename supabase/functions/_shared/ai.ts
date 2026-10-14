// IA con Google Gemini (tiene nivel gratuito). Cambiable por otro proveedor
// modificando solo este archivo.
const KEY = Deno.env.get('GEMINI_API_KEY')!;
const MODEL = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash';

type Part = { text: string } | { inline_data: { mime_type: string; data: string } };

export async function gemini(opts: {
  system: string;
  contents: { role: 'user' | 'model'; parts: Part[] }[];
  json?: boolean;
  maxTokens?: number;
}): Promise<string> {
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: opts.system }] },
      contents: opts.contents,
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: opts.maxTokens ?? 800,
        ...(opts.json ? { responseMimeType: 'application/json' } : {}),
      },
      safetySettings: [{ category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' }],
    }),
  });
  if (!r.ok) throw new Error(`Gemini ${r.status}: ${await r.text()}`);
  const d = await r.json();
  return d?.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') ?? '';
}
