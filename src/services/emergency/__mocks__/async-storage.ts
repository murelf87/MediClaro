/**
 * Mock de AsyncStorage para tests.
 * Usa un Map en memoria — se resetea entre tests con __reset().
 *
 * Los helpers (__reset, __set, __get) se importan como named exports desde
 * los tests: Jest resuelve este archivo por la misma ruta que el
 * moduleNameMapper, así que comparten la misma instancia en memoria.
 */

const _store = new Map<string, string>();

export function __reset() { _store.clear(); }
export function __set(key: string, value: string) { _store.set(key, value); }
export function __get(key: string) { return _store.get(key); }

const AsyncStorage = {
  getItem:    async (key: string) => _store.get(key) ?? null,
  setItem:    async (key: string, value: string) => { _store.set(key, value); },
  removeItem: async (key: string) => { _store.delete(key); },
  clear:      async () => { _store.clear(); },
  multiGet:   async (keys: string[]) => keys.map(k => [k, _store.get(k) ?? null] as [string, string | null]),
  multiSet:   async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => _store.set(k, v)); },
  multiRemove: async (keys: string[]) => { keys.forEach(k => _store.delete(k)); },
  getAllKeys:  async () => Array.from(_store.keys()),
  // Helpers accesibles también en el default export
  __reset: () => { _store.clear(); },
  __set:   (key: string, value: string) => { _store.set(key, value); },
  __get:   (key: string) => _store.get(key),
};

export default AsyncStorage;
