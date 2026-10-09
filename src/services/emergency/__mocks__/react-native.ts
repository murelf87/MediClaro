/**
 * Mock mínimo de react-native para tests de servicios.
 */

let _canOpenURL = true;
let _openURLFails = false;

export function __setCanOpenURL(val: boolean) { _canOpenURL = val; }
export function __setOpenURLFails(val: boolean) { _openURLFails = val; }
export function __reset() { _canOpenURL = true; _openURLFails = false; }

export const Linking = {
  canOpenURL: jest.fn(async (_url: string) => _canOpenURL),
  openURL:    jest.fn(async (url: string) => {
    if (_openURLFails) throw new Error('Linking.openURL failed');
    return url;
  }),
};

export const Platform = {
  select: (obj: Record<string, unknown>) => obj.android ?? obj.default,
  OS: 'android',
};

export const Alert = {
  alert: jest.fn(),
};

/** AppState mínimo: los tests pueden simular que la app pasa a segundo plano y vuelve. */
type AppStateListener = (state: string) => void;
const _appStateListeners = new Set<AppStateListener>();
export const AppState = {
  currentState: 'active',
  addEventListener: jest.fn((_type: string, listener: AppStateListener) => {
    _appStateListeners.add(listener);
    return { remove: () => _appStateListeners.delete(listener) };
  }),
};
export function __emitAppState(state: string) {
  AppState.currentState = state;
  _appStateListeners.forEach((l) => l(state));
}
