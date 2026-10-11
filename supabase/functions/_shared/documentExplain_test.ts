import { cleanDocumentImages, cleanDocumentReply, MAX_DOC_IMAGE_CHARS } from './documentExplain.ts';
function eq(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
const ok = 'A'.repeat(400);
Deno.test('acepta de 1 a 3 fotos y quita el prefijo data:', () => {
  eq(cleanDocumentImages(['data:image/jpeg;base64,' + ok]).images, [ok]);
  eq(cleanDocumentImages([ok, ok, ok]).images.length, 3);
});
Deno.test('rechaza vacío, más de 3, no texto, base64 raro y demasiado grande', () => {
  for (const bad of [undefined, [], [ok, ok, ok, ok], [5], ['!!' + ok], ['A'.repeat(MAX_DOC_IMAGE_CHARS + 1)], ['abc']]) {
    eq(cleanDocumentImages(bad).error !== null, true);
  }
});
Deno.test('limpia el Markdown de la respuesta', () => {
  eq(cleanDocumentReply('## Título\n**Hola**\n- uno\n\n\n\n- dos'), 'Título\nHola\n• uno\n\n• dos');
});
