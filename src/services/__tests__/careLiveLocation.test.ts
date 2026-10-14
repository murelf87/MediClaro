jest.mock('expo-location', () => ({}));
jest.mock('../../lib/supabase', () => ({ supabase: {} }));
import { liveErrorMessage, parseLive } from '../CareLiveLocationService';

describe('CareLiveLocationService', () => {
  it('sin ubicación activa no devuelve coordenadas', () => {
    expect(parseLive({ active: false, latitude: 1, longitude: 2 }).latitude).toBeNull();
    expect(parseLive(null).active).toBe(false);
  });
  it('lee la ubicación activa', () => {
    const l = parseLive({ active: true, mine: false, expiresAt: '2026-10-14T20:00:00Z', latitude: 40.4, longitude: -3.7, updatedAt: 'x' });
    expect(l).toMatchObject({ active: true, latitude: 40.4, longitude: -3.7 });
  });
  it('ignora coordenadas que no son números', () => {
    expect(parseLive({ active: true, latitude: '40', longitude: NaN }).latitude).toBeNull();
  });
  it('traduce los códigos del servidor', () => {
    expect(liveErrorMessage({ message: 'PREMIUM_REQUIRED' })).toMatch(/Premium/);
    expect(liveErrorMessage({ message: 'otra cosa' })).toMatch(/Inténtalo/);
  });
});
