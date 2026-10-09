import { createClient, SupabaseClient, User } from 'npm:@supabase/supabase-js@2';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function fail(message: string, status = 400, code?: string) {
  return json({ error: message, code }, status);
}

/** Error HTTP controlado para que las Edge Functions devuelvan el estado/código correcto. */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'HttpError';
  }
}

/** Cliente con privilegios de servidor. Nunca sale del backend. */
export const admin: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

/** Valida el JWT del usuario. Devuelve null si no es válido. */
export async function getUser(req: Request): Promise<User | null> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return null;
  const { data, error } = await admin.auth.getUser(token);
  return error ? null : data.user;
}

export async function rateLimit(userId: string, bucket: string, max: number) {
  const { data } = await admin.rpc('hit_rate_limit', { p_user: userId, p_bucket: bucket, p_max: max });
  return data === true;
}

/** Envoltorio común: CORS, método, autenticación, límite y errores sin filtrar detalles. */
export function handler(
  opts: { bucket: string; maxPerMinute: number; maxBodyBytes?: number },
  fn: (req: Request, user: User, body: any) => Promise<Response>,
) {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
    if (req.method !== 'POST') return fail('Método no permitido', 405);
    const len = Number(req.headers.get('content-length') ?? 0);
    if (len > (opts.maxBodyBytes ?? 64_000)) return fail('Petición demasiado grande', 413);
    const user = await getUser(req);
    if (!user) return fail('Sesión caducada. Vuelva a entrar.', 401);
    if (!(await rateLimit(user.id, opts.bucket, opts.maxPerMinute)))
      return fail('Demasiadas peticiones. Espere un momento.', 429);
    try {
      const body = await req.json().catch(() => ({}));
      return await fn(req, user, body);
    } catch (e) {
      if (e instanceof HttpError) {
        return fail(e.message, e.status, e.code);
      }
      console.error(opts.bucket, e);
      return fail('Ha ocurrido un error. Inténtelo de nuevo.', 500);
    }
  };
}
