// Doble de expo-crypto para las pruebas en Node (no hay módulo nativo).
import { randomUUID as nodeRandomUUID } from 'crypto';

export function randomUUID(): string {
  return nodeRandomUUID();
}
export async function digestStringAsync(): Promise<string> {
  return '';
}
export const CryptoDigestAlgorithm = { SHA256: 'SHA-256' };
