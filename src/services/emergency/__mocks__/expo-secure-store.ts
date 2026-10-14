// Mock de expo-secure-store para tests en Node
const _store = new Map<string, string>();

export const getItemAsync    = jest.fn(async (key: string) => _store.get(key) ?? null);
export const setItemAsync    = jest.fn(async (key: string, value: string) => { _store.set(key, value); });
export const deleteItemAsync = jest.fn(async (key: string) => { _store.delete(key); });

export function __reset() { _store.clear(); }
