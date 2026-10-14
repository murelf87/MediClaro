/**
 * Mock del cliente Supabase para tests.
 * Simula: sin sesión, backend caído, y respuesta correcta.
 */

type MockMode = 'no_session' | 'backend_error' | 'success';
let _mode: MockMode = 'no_session';

export function __setMode(m: MockMode) { _mode = m; }
export function __reset() { _mode = 'no_session'; }

const makeSingle = () => ({
  single: jest.fn(async () => {
    if (_mode === 'backend_error') return { data: null, error: { message: 'Network error' } };
    if (_mode === 'no_session') return { data: null, error: { message: 'Not authenticated' } };
    return { data: null, error: null };
  }),
});

export const supabase = {
  auth: {
    getUser: jest.fn(async () => {
      if (_mode === 'no_session') return { data: { user: null }, error: null };
      return { data: { user: { id: 'test-user-id' } }, error: null };
    }),
  },
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => makeSingle()),
    })),
    upsert: jest.fn(() => ({
      select: jest.fn(() => makeSingle()),
    })),
    delete: jest.fn(() => ({
      eq: jest.fn(async () => (_mode === 'backend_error' ? { error: { message: 'Network error' } } : { error: null })),
    })),
  })),
};
