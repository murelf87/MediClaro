/**
 * Enlaces de Google Maps (formato oficial «Maps URLs»): en el móvil abren la app de Google Maps si está instalada y,
 * si no, Google Maps en el navegador.
 */
const coord = (n: number) => (Number.isFinite(n) ? n.toFixed(6) : '0');

/** Ruta paso a paso desde donde está el teléfono hasta ese punto («Cómo llegar»). */
export function directionsUrl(latitude: number, longitude: number, mode: 'driving' | 'walking' = 'driving'): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${coord(latitude)},${coord(longitude)}&travelmode=${mode}`;
}

/** El punto en el mapa. */
export function placeUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${coord(latitude)},${coord(longitude)}`;
}
