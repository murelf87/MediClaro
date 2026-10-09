/**
 * Alarma y voz del aviso de una toma (con la app en primer plano):
 *  - `ring()`: el sonido de ALARMA de MediClaro (el mismo de los avisos del teléfono), una vez, como un despertador;
 *  - `speak()`: la voz natural del asistente que la persona eligió (Sulafat o Achird). Si la voz natural no está
 *    disponible (sin conexión, Modo demostración), el aviso NO se queda mudo: se lee con la voz del teléfono, en
 *    español y sin mostrar ningún mensaje que interrumpa.
 * La voz nunca suena sola con la app cerrada (iOS y Android no lo permiten): ahí avisa el sonido de alarma del aviso.
 */
import { useCallback, useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { createAudioPlayer, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { DemoMode, SpeechService, type GeminiVoice } from '../services';
import { configureAudioForSpeech } from '../utils/audio';
import { naturalPlaybackRate } from '../utils/playbackRate';

/* eslint-disable-next-line @typescript-eslint/no-require-imports */
const ALARM = require('../../assets/sounds/mediclaro_alarma.wav');
/** La alarma dura 10,2 s; si el reproductor no avisa del final, se sigue igualmente. */
const ALARM_MAX_MS = 11_000;

export function useReminderVoice() {
  const player = useRef<AudioPlayer | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const token = useRef(0);

  const stop = useCallback(() => {
    token.current += 1;
    try {
      player.current?.remove();
    } catch {
      // ya liberado
    }
    player.current = null;
    cleanup.current?.();
    cleanup.current = null;
    Speech.stop();
  }, []);

  /** Suena la alarma una vez. Termina al acabar el sonido, al llamar a `stop()` o si no puede sonar. */
  const ring = useCallback(async (): Promise<boolean> => {
    stop();
    const my = token.current;
    try {
      await configureAudioForSpeech();
      if (my !== token.current) return false;
      const p = createAudioPlayer(ALARM, { updateInterval: 250 });
      player.current = p;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, ALARM_MAX_MS);
        const sub = p.addListener('playbackStatusUpdate', (s: AudioStatus) => {
          if (my !== token.current || s.didJustFinish || s.error) {
            clearTimeout(timer);
            sub.remove();
            resolve();
          }
        });
        p.play();
      });
      if (my !== token.current) return false;
      try {
        p.remove();
      } catch {
        // ya liberado
      }
      if (player.current === p) player.current = null;
      return true;
    } catch {
      return false;
    }
  }, [stop]);

  const speak = useCallback(
    async (text: string, voice: GeminiVoice, rate = 0.85) => {
      stop();
      const my = token.current;
      const deviceVoice = () => {
        if (my !== token.current) return;
        Speech.speak(text, { language: 'es-ES', rate: Math.max(0.6, Math.min(1, rate)) });
      };
      // En la web (pruebas) y en el Modo demostración no hay voz natural para cualquier texto: voz del dispositivo.
      if (DemoMode.isActive() || Platform.OS === 'web') {
        deviceVoice();
        return;
      }
      try {
        await configureAudioForSpeech();
        const audio = await SpeechService.synthesize(text, voice, 'assistant');
        if (my !== token.current) {
          audio.cleanup();
          return;
        }
        const p = createAudioPlayer(audio.uri, { downloadFirst: true, updateInterval: 250 });
        p.playbackRate = naturalPlaybackRate(rate);
        p.shouldCorrectPitch = true;
        player.current = p;
        cleanup.current = audio.cleanup;
        p.play();
      } catch {
        deviceVoice();
      }
    },
    [stop],
  );

  useEffect(() => stop, [stop]);
  return { ring, speak, stop };
}
