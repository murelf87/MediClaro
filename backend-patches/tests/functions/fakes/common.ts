// Doble de prueba de supabase/functions/_shared/common.ts: mismas exportaciones, sin red.
// `admin` imita el constructor de consultas de supabase-js sobre tablas en memoria.
// deno-lint-ignore-file no-explicit-any
import { type Call, type Row, state } from './state.ts';

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

type Filter = (r: Row) => boolean;

class FakeQuery implements PromiseLike<{ data: any; error: any }> {
  private op: Call['op'] = 'select';
  private payload: any;
  private columns = '*';
  private filters: Filter[] = [];
  private filterText: string[] = [];
  private mode: 'many' | 'single' | 'maybe' = 'many';

  constructor(private table: string) {}

  select(cols = '*') {
    if (this.op === 'select') this.columns = cols;
    return this;
  }
  insert(payload: any) {
    this.op = 'insert';
    this.payload = payload;
    return this;
  }
  update(payload: any) {
    this.op = 'update';
    this.payload = payload;
    return this;
  }
  delete() {
    this.op = 'delete';
    return this;
  }
  eq(col: string, value: unknown) {
    this.filters.push((r) => r[col] === value);
    this.filterText.push(`${col}=${value}`);
    return this;
  }
  gte(col: string, value: unknown) {
    this.filters.push((r) => r[col] != null && String(r[col]) >= String(value));
    this.filterText.push(`${col}>=${value}`);
    return this;
  }
  lte(col: string, value: unknown) {
    this.filters.push((r) => r[col] != null && String(r[col]) <= String(value));
    this.filterText.push(`${col}<=${value}`);
    return this;
  }
  neq(col: string, value: unknown) {
    this.filters.push((r) => r[col] !== value);
    this.filterText.push(`${col}!=${value}`);
    return this;
  }
  order(_col: string, _opts?: unknown) {
    return this;
  }
  limit(_n: number) {
    return this;
  }
  is(col: string, value: unknown) {
    this.filters.push((r) => (r[col] ?? null) === value);
    this.filterText.push(`${col} is ${value}`);
    return this;
  }
  /** Solo la forma que usa el backend: "a.eq.X,b.eq.Y". */
  or(expr: string) {
    const parts = expr.split(',').map((p) => {
      const [col, op, ...rest] = p.split('.');
      if (op !== 'eq') throw new Error(`or(): operador no soportado en el doble: ${op}`);
      return { col, value: rest.join('.') };
    });
    this.filters.push((r) => parts.some((p) => String(r[p.col]) === p.value));
    this.filterText.push(`or(${expr})`);
    return this;
  }
  single() {
    this.mode = 'single';
    return this;
  }
  maybeSingle() {
    this.mode = 'maybe';
    return this;
  }

  then<A = { data: any; error: any }, B = never>(
    onfulfilled?: ((value: { data: any; error: any }) => A | PromiseLike<A>) | null,
    onrejected?: ((reason: unknown) => B | PromiseLike<B>) | null,
  ): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.exec()).then(onfulfilled, onrejected);
  }

  private exec(): { data: any; error: any } {
    state.calls.push({ table: this.table, op: this.op, payload: this.payload, filters: this.filterText });
    const key = `${this.table}:${this.op}`;
    const forced = state.failNext[key];
    if (forced) {
      delete state.failNext[key];
      return { data: null, error: forced };
    }
    const rows = (state.tables[this.table] ??= []);
    const match = (r: Row) => this.filters.every((f) => f(r));
    switch (this.op) {
      case 'insert': {
        const list = Array.isArray(this.payload) ? this.payload : [this.payload];
        // Como el valor por defecto de la base de datos (gen_random_uuid) en las tablas nuevas que lo usan.
        const withId = (r: Row) => (this.table === 'family_pay_invites' && !r.id ? { id: crypto.randomUUID(), ...r } : { ...r });
        rows.push(...list.map(withId));
        return { data: null, error: null };
      }
      case 'update': {
        rows.filter(match).forEach((r) => Object.assign(r, this.payload));
        return { data: null, error: null };
      }
      case 'delete': {
        state.tables[this.table] = rows.filter((r) => !match(r));
        return { data: null, error: null };
      }
      default: {
        const cols = this.columns.split(',').map((c) => c.trim());
        const project = (r: Row) => (this.columns === '*' ? { ...r } : Object.fromEntries(cols.map((c) => [c, r[c] ?? null])));
        const found = rows.filter(match).map(project);
        if (this.mode === 'single') {
          return found.length === 1 ? { data: found[0], error: null } : { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        }
        if (this.mode === 'maybe') return { data: found[0] ?? null, error: null };
        return { data: found, error: null };
      }
    }
  }
}

/** Persona de la sesión: la de state.user si la petición trae «Authorization: Bearer …». */
export function getUser(req: Request): Promise<any> {
  return Promise.resolve(req.headers.get('Authorization') ? state.user : null);
}

export function rateLimit(_userId: string, _bucket: string, _max: number): Promise<boolean> {
  return Promise.resolve(true);
}

export const admin: any = {
  from: (table: string) => new FakeQuery(table),
  rpc: () => Promise.resolve({ data: true, error: null }),
  auth: {
    admin: {
      deleteUser: (id: string) => {
        state.deletedUsers.push(id);
        return Promise.resolve({ data: null, error: null });
      },
    },
  },
};

/** Como el `handler` real, pero con la persona de la sesión ya autenticada (state.user). */
export function handler(
  _opts: { bucket: string; maxPerMinute: number; maxBodyBytes?: number },
  fn: (req: Request, user: any, body: any) => Promise<Response>,
) {
  return async (req: Request) => {
    try {
      const body = await req.json().catch(() => ({}));
      return await fn(req, state.user, body);
    } catch (e) {
      console.error('[doble handler]', e);
      return fail('Ha ocurrido un error. Inténtelo de nuevo.', 500);
    }
  };
}
