// Estado en memoria compartido por los dobles de prueba (base de datos, Stripe y usuario de la sesión).
// deno-lint-ignore-file no-explicit-any

export type Row = Record<string, any>;
export interface DbError {
  code: string;
  message: string;
}
export interface Call {
  table: string;
  op: 'select' | 'insert' | 'update' | 'delete';
  payload?: any;
  filters: string[];
}

export const state = {
  tables: {} as Record<string, Row[]>,
  calls: [] as Call[],
  /** Próximo error a devolver por tabla y operación, p. ej. `failNext['stripe_events:insert']`. */
  failNext: {} as Record<string, DbError>,
  subscriptions: {} as Record<string, any>,
  canceledSubscriptions: [] as string[],
  deletedUsers: [] as string[],
  checkoutSessions: [] as any[],
  customers: [] as any[],
  user: { id: '00000000-0000-4000-8000-000000000001', email: null as string | null, phone: '34600123456' } as any,
};

export function reset() {
  state.tables = {};
  state.calls = [];
  state.failNext = {};
  state.subscriptions = {};
  state.canceledSubscriptions = [];
  state.deletedUsers = [];
  state.checkoutSessions = [];
  state.customers = [];
}

export function callsTo(table: string, op?: Call['op']) {
  return state.calls.filter((c) => c.table === table && (!op || c.op === op));
}
