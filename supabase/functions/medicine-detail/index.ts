// Ficha del medicamento: datos oficiales + resumen sencillo derivado SOLO del prospecto oficial.
// El resumen se genera una vez por medicamento y se cachea (control de costes).
import { fail, handler, json } from '../_shared/common.ts';
import { providerFor } from '../_shared/providers/index.ts';
import { ProviderUnavailableError } from '../_shared/providers/types.ts';
import { cached } from '../_shared/cache.ts';
import { gemini } from '../_shared/ai.ts';
import { COST, logEvent } from '../_shared/metrics.ts';
import { requirePremium } from '../_shared/entitlements.ts';

const SIMPLIFY = `Resumes prospectos oficiales para personas mayores. Devuelve SOLO JSON:
{"paraQue": string, "comoSeToma": string, "avisos": [string], "conservacion": string}
Reglas estrictas:
- Usa EXCLUSIVAMENTE información presente en el TEXTO OFICIAL. Si un dato no aparece, escribe "".
- Frases cortas y palabras sencillas. "paraQue" y "comoSeToma": máximo 45 palabras cada uno.
- "comoSeToma": solo la forma general de tomarlo (con agua, con comida…). NO copies dosis. Termina con "Siga la pauta de su médico".
- "avisos": las 3 advertencias más importantes del texto (máximo 20 palabras cada una).
- No añadas conocimiento propio, ni interacciones, ni consejos que no estén en el texto.`;

Deno.serve(handler({ bucket: 'detail', maxPerMinute: 20 }, async (_req, user, body) => {
  const id = String(body.id ?? '');
  if (!/^[\w-]{1,40}$/.test(id)) return fail('Medicamento no válido');
  const entitlement = await requirePremium(user.id);
  const provider = providerFor(entitlement.country);

  try {
    const med = await provider.getMedication(id);
    if (!med) return fail('No encontrado en la base oficial', 404);
    const [leaflet, leafletUrl, sheetUrl] = await Promise.all([
      provider.getLeaflet(id), provider.getLeafletUrl(id), provider.getTechnicalSheetUrl(id),
    ]);

    let simple: any = null;
    if (leaflet.length) {
      try {
        simple = await cached('simple-es', `${provider.id}:${id}:v1`, 24 * 30, async () => {
          const text = leaflet.filter(s => s.key !== 'efectos').map(s => `[${s.title}]\n${s.text.slice(0, 3500)}`).join('\n\n');
          const out = await gemini({ system: SIMPLIFY, json: true, maxTokens: 700,
            contents: [{ role: 'user', parts: [{ text: `MEDICAMENTO: ${med.nombre}\n\nTEXTO OFICIAL:\n${text}` }] }] });
          await logEvent(user.id, 'ai_call', 'gemini_simplify', COST.gemini_text);
          return JSON.parse(out);
        });
      } catch (e) {
        await logEvent(user.id, 'error', 'ai_simplify_failed'); console.error(e);
        simple = null; // se muestra el texto oficial sin resumen: nunca inventamos
      }
    }

    return json({
      medicine: med,
      simple: simple ? { ...simple, generatedFrom: med.source.label, aiAssisted: true } : null,
      leaflet,               // texto oficial por secciones, con su fuente
      leafletUrl, sheetUrl,
    });
  } catch (e) {
    if (e instanceof ProviderUnavailableError) {
      return fail('Ahora mismo no hemos podido consultar la información oficial. Inténtelo de nuevo.', 503, 'PROVIDER_DOWN');
    }
    throw e;
  }
}));
