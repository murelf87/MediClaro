/**
 * Los textos que la app reproduce con la voz natural pública (`tts-preview`) deben estar en la lista permitida
 * del servidor exactamente igual; si no, el servidor responde 403 y la persona oye «Voz natural no disponible».
 */
import * as fs from 'fs';
import * as path from 'path';
import { VOICE_PREVIEW_TEXTS } from '../voicePreviews';

const root = path.resolve(__dirname, '../../..');
const serverAllowList = fs.readFileSync(path.join(root, 'supabase/functions/tts-preview/index.ts'), 'utf8');

describe('Textos de voz pública sincronizados con el servidor', () => {
  test.each(Object.entries(VOICE_PREVIEW_TEXTS))('%s está permitido en tts-preview', (_key, text) => {
    expect(serverAllowList.includes(text)).toBe(true);
  });

  test('la respuesta de ejemplo de Lucía en el Modo demostración usa la muestra permitida', () => {
    const demoData = fs.readFileSync(path.join(root, 'src/mocks/demoData.ts'), 'utf8');
    expect(demoData.includes(`reply: '${VOICE_PREVIEW_TEXTS.demoSample}'`)).toBe(true);
  });

  test('el servidor pide español de España en todas las voces', () => {
    const tts = fs.readFileSync(path.join(root, 'supabase/functions/tts/index.ts'), 'utf8');
    expect(tts).toMatch(/Spanish from Spain/);
    expect(serverAllowList).toMatch(/Spanish from Spain/);
  });
});
