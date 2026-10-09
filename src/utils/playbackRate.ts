/**
 * Velocidad de reproducción de una voz natural ya grabada a partir de la preferencia de lectura.
 * 0,85 era la velocidad «Normal» de la voz del sistema: con voz natural, «Normal» es su velocidad real (1×).
 * Se evita estirar mucho el audio (sonaría metálico): solo 0,9× (más lento) o 1,12× (más rápido).
 */
export function naturalPlaybackRate(rate: number): number {
  if (rate <= 0.77) return 0.9;
  if (rate >= 0.93) return 1.12;
  return 1;
}
