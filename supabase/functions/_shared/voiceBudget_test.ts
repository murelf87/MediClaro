function assertEquals(a: unknown, b: unknown) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
Deno.env.set('SUPABASE_URL', 'http://localhost');
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'test');
const { admin } = await import('./common.ts');
const { reserveVoiceBudget } = await import('./voiceBudget.ts');

function fake(result: { data?: unknown; error?: { code: string; message: string } | null } | Error) {
  const calls: unknown[] = [];
  (admin as any).rpc = (name: string, args: unknown) => {
    calls.push([name, args]);
    if (result instanceof Error) return Promise.reject(result);
    return Promise.resolve({ data: result.data ?? null, error: result.error ?? null });
  };
  return calls;
}

Deno.test('con sitio en el tope, deja pasar y reserva los caracteres', async () => {
  const calls = fake({ data: true });
  assertEquals(await reserveVoiceBudget(1234.4), true);
  assertEquals(calls, [['voice_budget_take', { p_chars: 1234 }]]);
});

Deno.test('tope del mes alcanzado: no se pide voz a Google', async () => {
  fake({ data: false });
  assertEquals(await reserveVoiceBudget(500), false);
});

Deno.test('migración sin aplicar o fallo de consulta: no se bloquea la voz', async () => {
  fake({ error: { code: '42883', message: 'function voice_budget_take does not exist' } });
  assertEquals(await reserveVoiceBudget(10), true);
  fake(new Error('red caída'));
  assertEquals(await reserveVoiceBudget(10), true);
});
