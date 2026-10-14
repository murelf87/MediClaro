import { directionsUrl, placeUrl } from '../maps';

test('«Cómo llegar» abre la ruta de Google Maps hasta la persona', () => {
  expect(directionsUrl(40.4168, -3.70379)).toBe('https://www.google.com/maps/dir/?api=1&destination=40.416800,-3.703790&travelmode=driving');
  expect(directionsUrl(40.4168, -3.70379, 'walking')).toContain('travelmode=walking');
});

test('ver el punto en el mapa', () => {
  expect(placeUrl(40.4168, -3.70379)).toBe('https://www.google.com/maps/search/?api=1&query=40.416800,-3.703790');
});
