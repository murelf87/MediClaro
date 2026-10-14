// Carga una Edge Function y devuelve su manejador HTTP sin abrir ningún puerto
// (sustituye Deno.serve solo mientras se importa el módulo).
// deno-lint-ignore-file no-explicit-any

export type Handler = (req: Request) => Promise<Response>;

export async function loadFunction(specifier: string): Promise<Handler> {
  let captured: Handler | null = null;
  const realServe = Deno.serve;
  (Deno as any).serve = (arg: any) => {
    captured = typeof arg === 'function' ? arg : arg?.handler;
    return { finished: Promise.resolve(), shutdown: () => Promise.resolve(), ref() {}, unref() {}, addr: {} };
  };
  try {
    await import(specifier);
  } finally {
    (Deno as any).serve = realServe;
  }
  if (!captured) throw new Error(`${specifier} no llamó a Deno.serve`);
  return captured;
}
