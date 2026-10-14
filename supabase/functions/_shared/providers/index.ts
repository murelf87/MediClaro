import type { MedicationDataProvider } from './types.ts';
import { ProviderNotSupportedError } from './types.ts';
import { cimaProvider } from './cima.ts';
import { usProvider } from './us.ts';

/** Registro explícito: nunca cae silenciosamente de un país a otro. */
export function providerFor(country = 'ES'): MedicationDataProvider {
  switch (country.toUpperCase()) {
    case 'ES': return cimaProvider;
    case 'US': return usProvider;
    default: throw new ProviderNotSupportedError(country);
  }
}
