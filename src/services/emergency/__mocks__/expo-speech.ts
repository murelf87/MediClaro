/**
 * Mock de expo-speech para tests.
 */

let _available = true;
export function __setAvailable(val: boolean) { _available = val; }

export async function getAvailableVoicesAsync() {
  return _available ? [{ identifier: 'es-ES', quality: 'Default', language: 'es-ES', name: 'Spanish' }] : [];
}

export async function speak(_text: string, _opts?: unknown) {
  if (!_available) throw new Error('TTS not available');
}

export function stop() {}
export function pause() {}
export function resume() {}
export async function isSpeakingAsync() { return false; }
