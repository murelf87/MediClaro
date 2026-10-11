function assert(v: unknown, msg = 'assert') { if (!v) throw new Error(msg); }
function assertEquals(a: unknown, b: unknown) { if (a !== b) throw new Error(`${String(a)} !== ${String(b)}`); }
import { ALPHABET, LENGTH, newCode, normalizeCode, pretty } from './code.ts';

Deno.test('normaliza el código escrito de cualquier forma', () => {
  assertEquals(normalizeCode('mc-4k7p 9x2q'), '4K7P9X2Q');
  assertEquals(normalizeCode('MC4K7P9X2Q'), '4K7P9X2Q');
  assertEquals(normalizeCode('4k7p-9x2q'), '4K7P9X2Q');
});
Deno.test('rechaza formas no válidas', () => {
  assertEquals(normalizeCode('MC-4K7P-9X2'), null);
  assertEquals(normalizeCode('MC-0O1I-9X2Q'), null);
  assertEquals(normalizeCode(12345678), null);
});
Deno.test('genera códigos válidos y distintos', () => {
  const seen = new Set<string>();
  for (let i = 0; i < 500; i += 1) {
    const c = newCode();
    assertEquals(c.length, LENGTH);
    for (const ch of c) assert(ALPHABET.includes(ch));
    assertEquals(normalizeCode(pretty(c)), c);
    seen.add(c);
  }
  assertEquals(seen.size, 500);
});
