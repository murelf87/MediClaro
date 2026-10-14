/**
 * Lectura larga (explicación de un medicamento) con la VOZ DEL TELÉFONO, por apartados seguidos.
 * Se usa cuando el propietario elige en el panel «la voz del teléfono» para toda la app.
 *  - La voz del sistema no dice cuánto dura: el progreso se calcula por la longitud del texto (aproximado).
 *  - Pausa = se detiene; al continuar, vuelve a leer el apartado en el que estaba (igual en iPhone y Android).
 */
import * as Speech from 'expo-speech';
import { speakOnDevice, type VoiceGender } from './deviceSpeech';

/** Letras por segundo de una voz del sistema en español a velocidad normal (aproximado). */
export const DEVICE_CHARS_PER_SECOND = 14;

export function estimateSeconds(text: string, rate: number): number {
  return Math.max(1, text.length / (DEVICE_CHARS_PER_SECOND * Math.max(0.5, rate)));
}

export interface DeviceReaderEvents {
  onProgress(seconds: number): void;
  onSpeaking(): void;
  onFinished(): void;
  onError(): void;
}

export interface DeviceReader {
  /** Duración estimada (segundos). */
  readonly total: number;
  /** Empieza o continúa (desde el principio del apartado actual). */
  play(): void;
  pause(): void;
  /** Vuelve a empezar desde el primer apartado. */
  restart(): void;
  stop(): void;
}

export function createDeviceReader(
  parts: string[],
  rateOf: () => number,
  events: DeviceReaderEvents,
  gender?: VoiceGender,
): DeviceReader {
  const estimates = parts.map((p) => estimateSeconds(p, rateOf()));
  const total = estimates.reduce((sum, s) => sum + s, 0);
  let index = 0;
  let done = 0;
  let startedAt = 0;
  let generation = 0;
  let timer: ReturnType<typeof setInterval> | null = null;

  const clearTimer = () => {
    if (timer) clearInterval(timer);
    timer = null;
  };

  const speakCurrent = () => {
    const my = ++generation;
    clearTimer();
    if (index >= parts.length) {
      events.onProgress(total);
      events.onFinished();
      return;
    }
    startedAt = Date.now();
    timer = setInterval(() => {
      if (my === generation) events.onProgress(done + Math.min(estimates[index], (Date.now() - startedAt) / 1000));
    }, 250);
    events.onSpeaking();
    const failed = () => {
      if (my !== generation) return;
      clearTimer();
      events.onError();
    };
    void speakOnDevice(
      parts[index],
      rateOf(),
      () => my === generation,
      {
        onDone: () => {
          if (my !== generation) return;
          done += estimates[index];
          index += 1;
          events.onProgress(done);
          speakCurrent();
        },
        onError: failed,
      },
      gender,
    ).catch(failed);
  };

  const halt = () => {
    generation += 1;
    clearTimer();
    Speech.stop();
  };

  return {
    total,
    play: speakCurrent,
    pause() {
      halt();
      events.onProgress(done);
    },
    restart() {
      halt();
      index = 0;
      done = 0;
      events.onProgress(0);
      speakCurrent();
    },
    stop: halt,
  };
}
