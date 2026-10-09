// Mock de expo-secure-store para tests en Node
const _store = new Map<string, string>();
let _biometrics = false;

export const WHEN_PASSCODE_SET_THIS_DEVICE_ONLY = 6;
export const getItemAsync    = jest.fn(async (key: string, _opts?: unknown) => _store.get(key) ?? null);
export const setItemAsync    = jest.fn(async (key: string, value: string, _opts?: unknown) => { _store.set(key, value); });
export const deleteItemAsync = jest.fn(async (key: string, _opts?: unknown) => { _store.delete(key); });
export const canUseBiometricAuthentication = jest.fn(() => _biometrics);

export function __setBiometrics(v: boolean) { _biometrics = v; }
export function __reset() { _store.clear(); _biometrics = false; }
