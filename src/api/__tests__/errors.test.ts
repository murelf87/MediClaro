/**
 * Tests — clasificación de las respuestas de error de las Edge Functions.
 * Lo importante: un límite del plan (o «solo Premium») nunca se confunde con una sesión caducada.
 */
import { PREMIUM_REQUIRED_CODE, kindFromHttp } from '../errors';

describe('kindFromHttp', () => {
  it('los límites del plan se reconocen por su código, con cualquier estado HTTP', () => {
    expect(kindFromHttp(402, 'LIMIT_REACHED')).toBe('limit_reached');
    expect(kindFromHttp(402, 'CHAT_LIMIT')).toBe('limit_reached');
    expect(kindFromHttp(402)).toBe('limit_reached');
  });

  it('«solo Premium» es un límite del plan, nunca «sesión caducada» (aunque llegue con 403)', () => {
    expect(kindFromHttp(402, PREMIUM_REQUIRED_CODE)).toBe('limit_reached');
    expect(kindFromHttp(403, PREMIUM_REQUIRED_CODE)).toBe('limit_reached');
    expect(kindFromHttp(403)).toBe('unauthorized');
  });

  it('resto de estados', () => {
    expect(kindFromHttp(400)).toBe('invalid_input');
    expect(kindFromHttp(401)).toBe('unauthorized');
    expect(kindFromHttp(404)).toBe('not_found');
    expect(kindFromHttp(409)).toBe('conflict');
    expect(kindFromHttp(429)).toBe('rate_limited');
    expect(kindFromHttp(503)).toBe('provider_down');
    expect(kindFromHttp(503, 'AI_DOWN')).toBe('provider_down');
    expect(kindFromHttp(500)).toBe('unknown');
  });
});
