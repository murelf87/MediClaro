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

/**
 * Aplica la velocidad a un reproductor de expo-audio.
 * En expo-audio 57 «playbackRate» es SOLO DE LECTURA: asignarlo (`player.playbackRate = 1`) lanza un error en el
 * teléfono y la voz natural no llegaba a sonar (la app pasaba a la voz del sistema o mostraba «Voz natural no
 * disponible»). La forma correcta es `setPlaybackRate()`, la misma que usa la explicación «Conocer MediClaro».
 */
export function applyPlaybackRate(
  player: { setPlaybackRate: (rate: number) => void; shouldCorrectPitch: boolean },
  rate: number,
): void {
  try {
    player.shouldCorrectPitch = true;
  } catch {
    // Sin corrección de tono la voz suena igual a velocidad 1×.
  }
  try {
    player.setPlaybackRate(rate);
  } catch {
    // Si el sistema no permite cambiar la velocidad, se reproduce a velocidad normal (nunca se cancela la voz).
  }
}
