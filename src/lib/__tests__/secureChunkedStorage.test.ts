/**
 * Tests — almacenamiento cifrado troceado (llavero / Keystore).
 */
import * as SecureStore from 'expo-secure-store';
import { secureTextStorage, safeStorageKey } from '../secureChunkedStorage';
import { __reset as resetSecureStore } from '../../services/emergency/__mocks__/expo-secure-store';

beforeEach(() => {
  resetSecureStore();
});

describe('secureTextStorage', () => {
  it('guarda y lee un valor pequeño', async () => {
    await secureTextStorage.setItem('clave', 'hola');
    expect(await secureTextStorage.getItem('clave')).toBe('hola');
  });

  it('trocea valores grandes (> 2 KB) y los recompone igual', async () => {
    const big = 'áéíóú-0123456789-'.repeat(600); // ~10 000 caracteres
    await secureTextStorage.setItem('perfil', big);
    expect(Number(await SecureStore.getItemAsync('perfil.n'))).toBeGreaterThan(1);
    expect(await secureTextStorage.getItem('perfil')).toBe(big);
  });

  it('borra todos los fragmentos', async () => {
    await secureTextStorage.setItem('perfil', 'x'.repeat(5000));
    await secureTextStorage.removeItem('perfil');
    expect(await secureTextStorage.getItem('perfil')).toBeNull();
    expect(await SecureStore.getItemAsync('perfil.0')).toBeNull();
    expect(await SecureStore.getItemAsync('perfil.n')).toBeNull();
  });

  it('al sobrescribir con un valor más corto no quedan fragmentos antiguos', async () => {
    await secureTextStorage.setItem('k', 'y'.repeat(6000));
    await secureTextStorage.setItem('k', 'corto');
    expect(await secureTextStorage.getItem('k')).toBe('corto');
    expect(await SecureStore.getItemAsync('k.3')).toBeNull();
  });

  it('lee valores antiguos guardados sin trocear', async () => {
    await SecureStore.setItemAsync('antiguo', '{"a":1}');
    expect(await secureTextStorage.getItem('antiguo')).toBe('{"a":1}');
  });

  it('normaliza las claves a los caracteres que admite SecureStore', async () => {
    expect(safeStorageKey('sb-abc-auth-token:user/1')).toBe('sb-abc-auth-token_user_1');
    await secureTextStorage.setItem('a:b', 'v');
    expect(await secureTextStorage.getItem('a:b')).toBe('v');
  });
});
